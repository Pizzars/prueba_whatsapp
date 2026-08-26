import { sendText, sendLocationRequest } from "./sendMessage";
import { client } from "@/app/lib/amplify-server";
import { listConversations } from "@/app/lib/graphql/queries";
import {
  createConversation,
  updateConversation,
} from "@/app/lib/graphql/mutations";
import { getSessionBySessionId } from "@/app/lib/sessions";
import { processChatMessage } from "@/app/lib/ai/chatbot";

// --- Types ---

export interface MessagePayload {
  type: string;
  text?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    name?: string;
  };
  interactive?: { id: string; title: string };
}

interface Conversation {
  id: string;
  phoneNumber: string;
  sessionId: string | null;
  state: string;
  selectedGame: string | null;
  selectedDraw: string | null;
  betNumber: string | null;
  betAmount: number | null;
  currentPage: number | null;
  updatedAt: string | null;
}

// --- Conversation state management ---

async function getConversation(
  phoneNumber: string
): Promise<Conversation | null> {
  const result = await client.graphql({
    query: listConversations,
    variables: { limit: 50 },
  });

  const items = (
    result as {
      data: { listConversations: { items: Conversation[] } };
    }
  ).data.listConversations.items;

  return items.find((c) => c.phoneNumber === phoneNumber) || null;
}

async function createOrUpdateConversation(
  conversation: Conversation | null,
  phoneNumber: string,
  updates: Partial<Conversation>
): Promise<Conversation> {
  const now = new Date().toISOString();

  if (!conversation) {
    const input = {
      phoneNumber,
      state: "idle",
      ...updates,
      updatedAt: now,
    };
    const result = await client.graphql({
      query: createConversation,
      variables: { input },
    });
    return (result as { data: { createConversation: Conversation } }).data
      .createConversation;
  }

  const input = {
    id: conversation.id,
    ...updates,
    updatedAt: now,
  };
  const result = await client.graphql({
    query: updateConversation,
    variables: { input },
  });
  return (result as { data: { updateConversation: Conversation } }).data
    .updateConversation;
}

// --- Chat history management ---
// Se usa betNumber (campo reutilizado) para guardar el historial serializado.
// En una implementación más robusta, se usaría una tabla dedicada.

interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

function getHistory(conversation: Conversation | null): ChatMessage[] {
  if (!conversation?.selectedDraw) return [];
  try {
    return JSON.parse(conversation.selectedDraw) as ChatMessage[];
  } catch {
    return [];
  }
}

function serializeHistory(history: ChatMessage[]): string {
  // Mantener solo los últimos 20 mensajes para no exceder límites
  const trimmed = history.slice(-20);
  return JSON.stringify(trimmed);
}

// --- Main handler ---

export async function handleIncomingMessage(
  phoneNumber: string,
  payload: MessagePayload
): Promise<void> {
  try {
    const conversation = await getConversation(phoneNumber);

    // Extraer texto del mensaje
    let userMessage = "";
    if (payload.type === "text") {
      userMessage = payload.text || "";
    } else if (payload.type === "location") {
      // Guardar ubicación y notificar al chatbot
      const { latitude, longitude } = payload.location!;
      await createOrUpdateConversation(conversation, phoneNumber, {
        betNumber: String(latitude),
        betAmount: longitude,
        state: "idle",
      });
      userMessage = `[El usuario compartió su ubicación: latitud ${latitude}, longitud ${longitude}]`;
    } else if (payload.type === "interactive") {
      userMessage = payload.interactive?.title || payload.interactive?.id || "";
    }

    if (!userMessage) return;

    // Obtener contexto de sesión
    let sessionId = conversation?.sessionId || null;
    let sessionToken: string | null = null;

    if (sessionId) {
      const session = await getSessionBySessionId(sessionId);
      if (session && session.active && new Date(session.expiresAt) > new Date()) {
        sessionToken = session.token;
      } else {
        sessionId = null; // Sesión expirada
      }
    }

    // Obtener historial
    const history = getHistory(conversation);

    // Obtener ubicación guardada
    const latitude = conversation?.betNumber ? parseFloat(conversation.betNumber) : null;
    const longitude = conversation?.betAmount || null;

    // Procesar con Gemini
    const response = await processChatMessage(userMessage, {
      phoneNumber,
      sessionId,
      sessionToken,
      latitude,
      longitude,
      history,
    });

    // Si se solicitó ubicación, enviar el mensaje interactivo
    if (response.locationRequested) {
      await sendLocationRequest(
        phoneNumber,
        "📍 Comparte tu ubicación para continuar:"
      );
    }

    // Enviar respuesta de texto
    if (response.text) {
      await sendText(phoneNumber, response.text);
    }

    // Actualizar historial
    const newHistory: ChatMessage[] = [
      ...history,
      { role: "user", parts: [{ text: userMessage }] },
      { role: "model", parts: [{ text: response.text }] },
    ];

    // Actualizar conversación en DynamoDB
    // Obtenemos el sessionId actualizado del contexto (puede haber cambiado si hizo login/logout)
    const updatedConversation = await getConversation(phoneNumber);
    await createOrUpdateConversation(
      updatedConversation || conversation,
      phoneNumber,
      {
        state: "idle",
        selectedDraw: serializeHistory(newHistory), // Historial serializado
      }
    );
  } catch (error) {
    console.error("Error en messageHandler:", error);
    // Fallback: enviar mensaje de error amigable
    await sendText(
      phoneNumber,
      "😅 Tuve un problema procesando tu mensaje. ¿Podrías intentar de nuevo?"
    );
  }
}
