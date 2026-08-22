const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const API_URL = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

async function sendRequest(body: object) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
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
