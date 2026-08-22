import { getWhatsAppConfig } from "@/app/lib/whatsapp-config";

async function sendRequest(body: object) {
  const config = await getWhatsAppConfig();
  const apiUrl = `https://graph.facebook.com/${config.whatsappApiVersion}/${config.whatsappPhoneNumberId}/messages`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsappToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Error enviando mensaje WhatsApp:", error);
  }

  return response;
}

/**
 * Enviar mensaje de texto simple
 */
export async function sendText(phoneNumber: string, message: string) {
  return sendRequest({
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "text",
    text: { body: message },
  });
}

/**
 * Enviar solicitud de ubicación al usuario
 */
export async function sendLocationRequest(phoneNumber: string, bodyText: string) {
  return sendRequest({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    type: "interactive",
    to: phoneNumber,
    interactive: {
      type: "location_request_message",
      body: {
        text: bodyText,
      },
      action: {
        name: "send_location",
      },
    },
  });
}

/**
 * Enviar mensaje interactivo con botones
 */
export async function sendButtons(
  phoneNumber: string,
  body: string,
  buttons: { id: string; title: string }[]
) {
  return sendRequest({
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((btn) => ({
          type: "reply",
          reply: { id: btn.id, title: btn.title },
        })),
      },
    },
  });
}

/**
 * Enviar mensaje interactivo con lista de opciones
 */
export async function sendList(
  phoneNumber: string,
  body: string,
  buttonText: string,
  sections: {
    title: string;
    rows: { id: string; title: string; description?: string }[];
  }[]
) {
  return sendRequest({
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: buttonText,
        sections,
      },
    },
  });
}
