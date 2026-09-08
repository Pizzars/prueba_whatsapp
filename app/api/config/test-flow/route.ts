import { NextResponse } from "next/server";
import { getWhatsAppConfig } from "@/app/lib/whatsapp-config";
import { WHATSAPP_FLOW_ID } from "@/app/lib/constants";

/**
 * POST /api/config/test-flow
 * Envía un mensaje interactivo con el flow login_test al número de pruebas.
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
        recipient_type: "individual",
        to: config.testPhoneNumber,
        type: "interactive",
        interactive: {
          type: "flow",
          header: {
            type: "text",
            text: "Iniciar sesión",
          },
          body: {
            text: "Ingresa tus credenciales para acceder a la Plataforma de Apuestas.",
          },
          footer: {
            text: "Plataforma de Apuestas",
          },
          action: {
            name: "flow",
            parameters: {
              flow_message_version: "3",
              flow_id: WHATSAPP_FLOW_ID,
              flow_cta: "Iniciar sesión",
              flow_action: "data_exchange",
              mode: "draft",
            },
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: "Error enviando flow",
        details: data,
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      messageId: data.messages?.[0]?.id || "sent",
      sentTo: config.testPhoneNumber,
      flowId: WHATSAPP_FLOW_ID,
    });
  } catch (error) {
    console.error("Error enviando flow de prueba:", error);
    return NextResponse.json({ error: "Error interno", details: String(error) }, { status: 500 });
  }
}
