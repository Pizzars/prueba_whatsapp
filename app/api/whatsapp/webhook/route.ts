import { NextResponse } from "next/server";
import { handleIncomingMessage } from "@/app/lib/whatsapp/messageHandler";
import { getWhatsAppConfig } from "@/app/lib/whatsapp-config";

/**
 * GET: Verificación del webhook por Meta
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
 * POST: Mensajes entrantes de WhatsApp
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages || value.messages.length === 0) {
      return NextResponse.json({ status: "ok" });
    }

    const message = value.messages[0];
    const phoneNumber = message.from;
    const messageType = message.type;

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

    handleIncomingMessage(phoneNumber, messagePayload).catch((err) => {
      console.error("Error procesando mensaje WhatsApp:", err);
    });

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Error en webhook WhatsApp:", error);
    return NextResponse.json({ status: "ok" });
  }
}
