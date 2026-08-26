import { sendText, sendLocationRequest, sendButtons } from "./sendMessage";
import { client } from "@/app/lib/amplify-server";
import { listConversations } from "@/app/lib/graphql/queries";
import {
  createConversation,
  updateConversation,
} from "@/app/lib/graphql/mutations";
import {
  createNewSession,
  getSessionBySessionId,
  associatePhoneNumber,
  deactivateSession,
} from "@/app/lib/sessions";
import { validateCredentials } from "@/app/lib/users";
import { processChatMessage } from "@/app/lib/ai/chatbot";
import { APP_URL } from "@/app/lib/constants";

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

async function getConversation(phoneNumber: string): Promise<Conversation | null> {
  const result = await client.graphql({ query: listConversations, variables: { limit: 50 } });
  const items = (result as { data: { listConversations: { items: Conversation[] } } }).data.listConversations.items;
  return items.find((c) => c.phoneNumber === phoneNumber) || null;
}

async function createOrUpdateConversation(
  conversation: Conversation | null,
  phoneNumber: string,
  updates: Partial<Conversation>
): Promise<Conversation> {
  const now = new Date().toISOString();
  if (!conversation) {
    const input = { phoneNumber, state: "idle", ...updates, updatedAt: now };
    const result = await client.graphql({ query: createConversation, variables: { input } });
    return (result as { data: { createConversation: Conversation } }).data.createConversation;
  }
  const input = { id: conversation.id, ...updates, updatedAt: now };
  const result = await client.graphql({ query: updateConversation, variables: { input } });
  return (result as { data: { updateConversation: Conversation } }).data.updateConversation;
}

// --- Chat history for AI ---

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
  return JSON.stringify(history.slice(-20));
}

// --- Main handler ---

export async function handleIncomingMessage(
  phoneNumber: string,
  payload: MessagePayload
): Promise<void> {
  try {
    const conversation = await getConversation(phoneNumber);
    const state = conversation?.state || "new";

    // Extraer texto del mensaje
    const text = payload.type === "text" ? payload.text || "" : "";
    const interactiveId = payload.type === "interactive" ? payload.interactive?.id || "" : "";

    // --- Comando global: "terminar" cierra sesión sin IA ---
    if (text.trim().toLowerCase() === "terminar") {
      if (conversation?.sessionId) {
        await deactivateSession(conversation.sessionId);
      }
      await createOrUpdateConversation(conversation, phoneNumber, {
        state: "new",
        sessionId: null,
        selectedGame: null,
        selectedDraw: null,
        betNumber: null,
        betAmount: null,
      });
      await sendText(
        phoneNumber,
        "👋 ¡Gracias por usar la Plataforma de Apuestas! Tu sesión ha sido cerrada.\n\n¡Te esperamos pronto! Escribe cualquier mensaje cuando desees volver. 🎰"
      );
      return;
    }

    // --- Flujo sin sesión: login rígido (sin IA) ---
    if (state === "new" || state === "choosing_login_method" || state === "awaiting_location" ||
        state === "awaiting_login" || state === "awaiting_documento" || state === "awaiting_password") {
      await handleLoginFlow(phoneNumber, conversation, state, payload, text, interactiveId);
      return;
    }

    // --- Con sesión activa: verificar que no haya expirado ---
    if (conversation?.sessionId) {
      const session = await getSessionBySessionId(conversation.sessionId);
      if (!session || !session.active || new Date(session.expiresAt) < new Date()) {
        // Sesión expirada
        await createOrUpdateConversation(conversation, phoneNumber, {
          state: "new",
          sessionId: null,
          selectedDraw: null,
        });
        await sendText(phoneNumber, "⚠️ Tu sesión ha expirado. Necesitas iniciar sesión nuevamente.");
        await sendButtons(phoneNumber, "¿Cómo deseas iniciar sesión?", [
          { id: "login_web", title: "Ingresar con URL" },
          { id: "login_whatsapp", title: "Usuario y contraseña" },
        ]);
        await createOrUpdateConversation(conversation, phoneNumber, { state: "choosing_login_method" });
        return;
      }
    }

    // --- Con sesión activa: delegar a Gemini IA ---
    await handleWithAI(phoneNumber, conversation!, payload, text);
  } catch (error) {
    console.error("Error en messageHandler:", error);
    await sendText(phoneNumber, "😅 Tuve un problema procesando tu mensaje. ¿Podrías intentar de nuevo?");
  }
}

// --- Login flow (sin IA, flujo rígido) ---

async function handleLoginFlow(
  phoneNumber: string,
  conversation: Conversation | null,
  state: string,
  payload: MessagePayload,
  text: string,
  interactiveId: string
): Promise<void> {
  switch (state) {
    case "new":
      await sendButtons(
        phoneNumber,
        "¡Hola! 👋 Bienvenido a la Plataforma de Apuestas.\n\n¿Cómo deseas iniciar sesión?",
        [
          { id: "login_web", title: "Ingresar con URL" },
          { id: "login_whatsapp", title: "Usuario y contraseña" },
        ]
      );
      await createOrUpdateConversation(conversation, phoneNumber, { state: "choosing_login_method" });
      break;

    case "choosing_login_method":
      if (interactiveId === "login_web" || text === "1") {
        const sessionId = crypto.randomUUID();
        const loginUrl = `${APP_URL}/login?session=${sessionId}`;
        await createOrUpdateConversation(conversation, phoneNumber, { sessionId, state: "awaiting_login" });
        await sendText(
          phoneNumber,
          `🔗 Abre este enlace para iniciar sesión:\n\n${loginUrl}\n\nDespués de iniciar sesión, vuelve aquí y envía cualquier mensaje.`
        );
      } else if (interactiveId === "login_whatsapp" || text === "2") {
        await sendLocationRequest(phoneNumber, "📍 Primero necesito tu ubicación. Compártela usando el botón:");
        await createOrUpdateConversation(conversation, phoneNumber, { state: "awaiting_location" });
      } else {
        await sendButtons(phoneNumber, "Por favor elige una opción:", [
          { id: "login_web", title: "Ingresar con URL" },
          { id: "login_whatsapp", title: "Usuario y contraseña" },
        ]);
      }
      break;

    case "awaiting_location":
      if (payload.type !== "location" || !payload.location) {
        await sendText(phoneNumber, "📍 Necesito tu ubicación para continuar. Usa el botón de compartir ubicación.");
        await sendLocationRequest(phoneNumber, "📍 Comparte tu ubicación:");
        return;
      }
      const { latitude, longitude } = payload.location;
      await createOrUpdateConversation(conversation, phoneNumber, {
        state: "awaiting_documento",
        betNumber: String(latitude),
        betAmount: longitude,
      });
      await sendText(phoneNumber, "✅ Ubicación recibida.\n\n📝 Ahora ingresa tu *número de documento* (10 dígitos):");
      break;

    case "awaiting_login":
      if (conversation?.sessionId) {
        const session = await getSessionBySessionId(conversation.sessionId);
        if (session && session.active) {
          await associatePhoneNumber(conversation.sessionId, phoneNumber);
          await createOrUpdateConversation(conversation, phoneNumber, { state: "idle" });
          await sendText(phoneNumber, `✅ ¡Sesión iniciada! Bienvenido, ${session.nombre}. 🎰\n\nAhora puedo ayudarte con tus apuestas. ¿Qué deseas hacer?`);
          return;
        }
      }
      if (text.toLowerCase() === "nuevo") {
        await createOrUpdateConversation(conversation, phoneNumber, { state: "new", sessionId: null });
        await sendButtons(phoneNumber, "¿Cómo deseas iniciar sesión?", [
          { id: "login_web", title: "Ingresar con URL" },
          { id: "login_whatsapp", title: "Usuario y contraseña" },
        ]);
        await createOrUpdateConversation(conversation, phoneNumber, { state: "choosing_login_method" });
      } else {
        await sendText(phoneNumber, "⏳ Aún no has iniciado sesión desde la web. Abre el enlace que te envié.\n\nEscribe *nuevo* para reiniciar el proceso.");
      }
      break;

    case "awaiting_documento":
      const documento = text.trim();
      if (!/^\d{10}$/.test(documento)) {
        await sendText(phoneNumber, "❌ El documento debe ser de 10 dígitos. Intenta de nuevo:");
        return;
      }
      await createOrUpdateConversation(conversation, phoneNumber, {
        state: "awaiting_password",
        selectedGame: documento,
      });
      await sendText(phoneNumber, `📋 Documento: *${documento}*\n\n🔒 Ahora ingresa tu *contraseña*:`);
      break;

    case "awaiting_password":
      const password = text.trim();
      if (!password) {
        await sendText(phoneNumber, "🔒 Ingresa tu contraseña:");
        return;
      }
      const doc = conversation?.selectedGame || "";
      const user = validateCredentials(doc, password);
      if (!user) {
        await sendText(phoneNumber, "❌ Documento o contraseña incorrectos.\n\nVamos a intentar de nuevo. Ingresa tu *número de documento* (10 dígitos):");
        await createOrUpdateConversation(conversation, phoneNumber, { state: "awaiting_documento", selectedGame: null });
        return;
      }
      const lat = parseFloat(conversation?.betNumber || "0");
      const lng = conversation?.betAmount || 0;
      const session = await createNewSession({ documento: user.documento, nombre: user.nombre, latitude: lat, longitude: lng });
      await associatePhoneNumber(session.sessionId, phoneNumber);
      await createOrUpdateConversation(conversation, phoneNumber, {
        sessionId: session.sessionId,
        state: "idle",
        betNumber: null,
        betAmount: null,
        selectedGame: null,
      });
      await sendText(phoneNumber, `✅ ¡Bienvenido, ${user.nombre}! Tu sesión está activa. 🎰\n\nAhora puedo ayudarte con tus apuestas. ¿Qué deseas hacer?`);
      break;
  }
}

// --- AI-powered flow (solo con sesión activa) ---

async function handleWithAI(
  phoneNumber: string,
  conversation: Conversation,
  payload: MessagePayload,
  text: string
): Promise<void> {
  // Extraer mensaje para la IA
  let userMessage = text;
  if (payload.type === "location" && payload.location) {
    userMessage = `[Ubicación compartida: ${payload.location.latitude}, ${payload.location.longitude}]`;
  } else if (payload.type === "interactive") {
    userMessage = payload.interactive?.title || payload.interactive?.id || text;
  }

  if (!userMessage) return;

  // Obtener historial
  const history = getHistory(conversation);

  // Llamar a Gemini
  const response = await processChatMessage(userMessage, {
    phoneNumber,
    sessionId: conversation.sessionId,
    sessionToken: null,
    latitude: conversation.betNumber ? parseFloat(conversation.betNumber) : null,
    longitude: conversation.betAmount,
    history,
  });

  // Si se solicitó ubicación
  if (response.locationRequested) {
    await sendLocationRequest(phoneNumber, "📍 Comparte tu ubicación:");
  }

  // Enviar respuesta
  if (response.text) {
    await sendText(phoneNumber, response.text);
  }

  // Actualizar historial
  const newHistory: ChatMessage[] = [
    ...history,
    { role: "user", parts: [{ text: userMessage }] },
    { role: "model", parts: [{ text: response.text }] },
  ];

  await createOrUpdateConversation(conversation, phoneNumber, {
    selectedDraw: serializeHistory(newHistory),
  });
}
