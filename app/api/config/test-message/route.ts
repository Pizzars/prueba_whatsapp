import { NextResponse } from "next/server";
import { getWhatsAppConfig } from "@/app/lib/whatsapp-config";

/**
 * POST: Enviar mensaje de prueba al número configurado
 */
export async function POST() {
  try {
    const config = await getWhatsAppConfig();

    if (!config.testPhoneNumber) {
      return NextResponse.json({ error: "No hay número de pruebas configurado" }, { status: 400 });
    }

    const apiUrl = `https://graph.facebook.com/${config.whatsappApiVersion}/${config.whatsappPhoneNumberId}/messages`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.whatsappToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: config.testPhoneNumber,
        type: "text",
        text: {
          body: "🧪 Mensaje de prueba desde la Plataforma de Apuestas.\n\nSi recibes este mensaje, la configuración de WhatsApp está correcta.",
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: "Error enviando mensaje",
        details: data,
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      messageId: data.messages?.[0]?.id || "sent",
      sentTo: config.testPhoneNumber,
    });
  } catch (error) {
    console.error("Error enviando mensaje de prueba:", error);
    return NextResponse.json({ error: "Error interno", details: String(error) }, { status: 500 });
  }
}
