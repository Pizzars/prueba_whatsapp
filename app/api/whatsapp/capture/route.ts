import { NextResponse } from "next/server";
import crypto from "crypto";
import { client } from "@/app/lib/amplify-server";
import { createWebhookCapture } from "@/app/lib/graphql/mutations";
import { getWhatsAppConfig } from "@/app/lib/whatsapp-config";
import { WHATSAPP_APP_SECRET } from "@/app/lib/constants";
import {
  handleIncomingMessage,
  type MessagePayload,
} from "@/app/lib/whatsapp/messageHandler";

/**
 * ENDPOINT DE DIAGNÓSTICO — Captura cruda del webhook de Meta + verificación de firma.
 *
 * Objetivo: ver EXACTAMENTE cómo llega la petición que firma Meta y comprobar la cabecera
 * `X-Hub-Signature-256`, para entender cómo se valida antes de aplicarlo en el webhook real.
 *
 * NO bloquea: aunque la firma no coincida, responde 200. Solo deja constancia en la tabla de
 * la firma de Meta, la firma que calculamos y si coinciden.
 *
 * IMPORTANTE: se lee el cuerpo CRUDO con `request.text()`, nunca `request.json()`. La firma
 * HMAC-SHA256 se calcula sobre los bytes exactos del cuerpo; reparsear rompería la comparación.
 */

/**
 * GET: handshake de verificación de Meta (una sola vez, al registrar la Callback URL).
 * El verify token NO firma nada; solo valida el registro.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const config = await getWhatsAppConfig();

  if (mode === "subscribe" && token === config.whatsappVerifyToken) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Verifica la firma de Meta sobre el cuerpo crudo.
 *
 * Meta manda `X-Hub-Signature-256: sha256=<hex>` donde <hex> = HMAC_SHA256(cuerpo, appSecret).
 * Recalculamos lo mismo y comparamos en tiempo constante.
 */
function verifySignature(rawBody: string, headerSignature: string | null) {
  // Firma esperada: la calculamos nosotros con el App Secret.
  const digest = crypto
    .createHmac("sha256", WHATSAPP_APP_SECRET)
    .update(rawBody, "utf8")
    .digest("hex");
  const expectedSignature = `sha256=${digest}`;

  if (!headerSignature) {
    return {
      expectedSignature,
      signatureValid: false,
      signatureNote:
        "La petición no trae cabecera X-Hub-Signature-256 (típico del GET de verificación).",
    };
  }

  // Comparación en tiempo constante para no filtrar información por tiempos.
  const a = Buffer.from(headerSignature);
  const b = Buffer.from(expectedSignature);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

  return {
    expectedSignature,
    signatureValid: valid,
    signatureNote: valid
      ? "La firma coincide: HMAC-SHA256(cuerpo crudo, App Secret) == X-Hub-Signature-256. Petición auténtica de Meta."
      : "La firma NO coincide. O el App Secret no corresponde, o el cuerpo se alteró antes de calcular el HMAC.",
  };
}

/**
 * Normaliza el mensaje del payload de Meta e invoca al chatbot para que responda.
 *
 * Responde de forma SÍNCRONA (llama directo al messageHandler, que envía por la WhatsApp
 * API) en vez de encolar en SQS: para esta prueba de la capa de seguridad no hace falta
 * la cola ni la Lambda worker. Solo se invoca cuando la firma es VÁLIDA, de modo que
 * validar la firma es lo que habilita la respuesta del chatbot.
 */
async function forwardToChatbot(rawBody: string) {
  const body = JSON.parse(rawBody);

  const value = body.entry?.[0]?.changes?.[0]?.value;
  if (!value?.messages || value.messages.length === 0) {
    return; // No es un mensaje (p. ej. un status): no hay nada que responder.
  }

  const message = value.messages[0];
  const phoneNumber = message.from;
  const messageType = message.type;

  let payload: MessagePayload;
  switch (messageType) {
    case "text":
      payload = { type: "text", text: message.text?.body || "" };
      break;
    case "location":
      payload = {
        type: "location",
        location: {
          latitude: message.location.latitude,
          longitude: message.location.longitude,
          address: message.location.address,
          name: message.location.name,
        },
      };
      break;
    case "interactive": {
      const reply =
        message.interactive?.button_reply || message.interactive?.list_reply;
      payload = {
        type: "interactive",
        interactive: { id: reply?.id || "", title: reply?.title || "" },
      };
      break;
    }
    default:
      payload = { type: "text", text: "" };
      break;
  }

  await handleIncomingMessage(phoneNumber, payload);
}

/**
 * POST: cada evento firmado de Meta. Se guarda la petición tal cual, se verifica la firma, y
 * se responde 200 de inmediato (nunca se bloquea en este diagnóstico).
 *
 * Si la firma es VÁLIDA, además se reenvía el mensaje al flujo del chatbot para que responda.
 * Si es inválida, solo se registra (no se procesa): así se ve el efecto de validar la firma.
 */
export async function POST(request: Request) {
  // 1. Cuerpo CRUDO (sin parsear).
  const rawBody = await request.text();

  // 2. Headers tal cual llegan.
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // 3. Firma de Meta y verificación con el App Secret.
  const signature = request.headers.get("x-hub-signature-256");
  const { expectedSignature, signatureValid, signatureNote } = verifySignature(
    rawBody,
    signature
  );

  const { search } = new URL(request.url);

  try {
    await client.graphql({
      query: createWebhookCapture,
      variables: {
        input: {
          method: "POST",
          receivedAt: new Date().toISOString(),
          signature,
          expectedSignature,
          signatureValid,
          signatureNote,
          headers: JSON.stringify(headers),
          rawBody,
          queryString: search || null,
        },
      },
    });
  } catch (err) {
    // Un fallo de guardado no debe provocar un 500 (haría que Meta reintente).
    console.error("Error guardando captura del webhook:", err);
  }

  // Solo si la firma es válida se reenvía al chatbot para que responda.
  // Así, la validación de la firma es lo que habilita la respuesta.
  if (signatureValid) {
    try {
      await forwardToChatbot(rawBody);
    } catch (err) {
      console.error("Error reenviando mensaje al chatbot:", err);
    }
  }

  // No se bloquea: siempre 200.
  return NextResponse.json({ status: "ok" });
}
