import { NextResponse } from "next/server";
import { handleIncomingMessage } from "@/app/lib/whatsapp/messageHandler";

const VERIFY_TOKEN = process.env.NEXT_PUBLIC_WHATSAPP_VERIFY_TOKEN || "";

/**
 * GET: Verificación del webhook por Meta
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST: Mensajes entrantes de WhatsApp
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Extraer mensaje del payload de WhatsApp
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Verificar que sea un mensaje (no un status update)
    if (!value?.messages || value.messages.length === 0) {
      return NextResponse.json({ status: "ok" });
    }

    const message = value.messages[0];
    const phoneNumber = message.from; // Número del remitente
    const messageText = message.text?.body || "";

    // Procesar el mensaje en background (no bloquear la respuesta)
    // WhatsApp espera respuesta rápida (< 5s)
    handleIncomingMessage(phoneNumber, messageText).catch((err) => {
      console.error("Error procesando mensaje WhatsApp:", err);
    });

    // Responder 200 inmediatamente
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Error en webhook WhatsApp:", error);
    return NextResponse.json({ status: "ok" });
  }
}
