import { NextResponse } from "next/server";
import { handleIncomingMessage } from "@/app/lib/whatsapp/messageHandler";
import { WHATSAPP_VERIFY_TOKEN } from "@/app/lib/constants";

/**
 * GET: Verificación del webhook por Meta
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
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
    const phoneNumber = message.from;
    const messageType = message.type;

    // Construir payload según tipo de mensaje
    let messagePayload: {
      type: string;
      text?: string;
      location?: { latitude: number; longitude: number; address?: string; name?: string };
      interactive?: { id: string; title: string };
    };

    switch (messageType) {
      case "text":
        messagePayload = {
          type: "text",
          text: message.text?.body || "",
        };
        break;

      case "location":
        messagePayload = {
          type: "location",
          location: {
            latitude: message.location.latitude,
            longitude: message.location.longitude,
            address: message.location.address,
            name: message.location.name,
          },
        };
        break;

      case "interactive":
        // Respuesta a botones o listas
        const interactiveReply =
          message.interactive?.button_reply || message.interactive?.list_reply;
        messagePayload = {
          type: "interactive",
          interactive: {
            id: interactiveReply?.id || "",
            title: interactiveReply?.title || "",
          },
        };
        break;

      default:
        messagePayload = {
          type: "text",
          text: "",
        };
        break;
    }

    // Procesar el mensaje
    handleIncomingMessage(phoneNumber, messagePayload).catch((err) => {
      console.error("Error procesando mensaje WhatsApp:", err);
    });

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Error en webhook WhatsApp:", error);
    return NextResponse.json({ status: "ok" });
  }
}
