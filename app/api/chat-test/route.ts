import { NextResponse } from "next/server";
import { client } from "@/app/lib/amplify-server";
import { listConversations } from "@/app/lib/graphql/queries";
import { createConversation, updateConversation } from "@/app/lib/graphql/mutations";
import {
  createNewSession,
  getSessionBySessionId,
  associatePhoneNumber,
  deactivateSession,
} from "@/app/lib/sessions";
import { validateCredentials } from "@/app/lib/users";
import { processChatMessage } from "@/app/lib/ai/chatbot";
import { APP_URL } from "@/app/lib/constants";

/**
 * POST /api/chat-test
 * Ejecuta el mismo flujo del messageHandler pero retorna los mensajes
 * directamente en la respuesta (NO envía a WhatsApp API).
 */

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

interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

// Collect messages instead of sending to WhatsApp
let responseMessages: string[] = [];
let locationRequested = false;

function collectText(message: string) {
  responseMessages.push(message);
}

function collectLocationRequest() {
  locationRequested = true;
  responseMessages.push("[📍 Se solicitó ubicación al usuario]");
}

function collectButtons(body: string) {
  responseMessages.push(body);
}

// --- Conversation helpers (same as messageHandler) ---

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

function getHistory(conversation: Conversation | null): ChatMessage[] {
  if (!conversation?.selectedDraw) return [];
  try { return JSON.parse(conversation.selectedDraw) as ChatMessage[]; }
  catch { return []; }
}

function serializeHistory(history: ChatMessage[]): string {
  return JSON.stringify(history.slice(-20));
}

// --- Main endpoint ---

export async function POST(request: Request) {
  const startTime = Date.now();
  responseMessages = [];
  locationRequested = false;

  try {
    const body = await request.json();
    const { type, text, phoneNumber: rawPhone, latitude, longitude } = body;

    const phoneNumber = rawPhone || "test-000000";
    const messageType = type || "text";
    const messageText = text || "";

    const conversation = await getConversation(phoneNumber);
    const state = conversation?.state || "new";

    // --- "terminar" ---
    if (messageText.trim().toLowerCase() === "terminar") {
      if (conversation?.sessionId) await deactivateSession(conversation.sessionId);
      await createOrUpdateConversation(conversation, phoneNumber, {
        state: "new", sessionId: null, selectedGame: null, selectedDraw: null, betNumber: null, betAmount: null,
      });
      collectText("👋 ¡Gracias por usar la Plataforma de Apuestas! Tu sesión ha sido cerrada.\n\n¡Te esperamos pronto! Escribe cualquier mensaje cuando desees volver. 🎰");
      return respond(startTime);
    }

    // --- Login flow ---
    if (["new", "choosing_login_method", "awaiting_location", "awaiting_login", "awaiting_documento", "awaiting_password"].includes(state)) {
      await handleLoginFlow(phoneNumber, conversation, state, messageType, messageText, latitude, longitude);
      return respond(startTime);
    }

    // --- Verify session ---
    if (conversation?.sessionId) {
      const session = await getSessionBySessionId(conversation.sessionId);
      if (!session || !session.active || new Date(session.expiresAt) < new Date()) {
        await createOrUpdateConversation(conversation, phoneNumber, { state: "new", sessionId: null, selectedDraw: null });
        collectText("⚠️ Tu sesión ha expirado. Necesitas iniciar sesión nuevamente.");
        collectButtons("¿Cómo deseas iniciar sesión?\n\n1. Ingresar con URL\n2. Usuario y contraseña");
        await createOrUpdateConversation(conversation, phoneNumber, { state: "choosing_login_method" });
        return respond(startTime);
      }
    }

    // --- AI flow ---
    let userMessage = messageText;
    if (messageType === "location") {
      userMessage = `[Ubicación compartida: ${latitude}, ${longitude}]`;
    }

    if (!userMessage) {
      return respond(startTime);
    }

    const history = getHistory(conversation);

    const aiResponse = await processChatMessage(userMessage, {
      phoneNumber,
      sessionId: conversation?.sessionId || null,
      sessionToken: null,
      latitude: conversation?.betNumber ? parseFloat(conversation.betNumber) : null,
      longitude: conversation?.betAmount || null,
      history,
    });

    if (aiResponse.text) collectText(aiResponse.text);

    // Update history
    const newHistory: ChatMessage[] = [
      ...history,
      { role: "user", parts: [{ text: userMessage }] },
      { role: "model", parts: [{ text: aiResponse.text }] },
    ];
    await createOrUpdateConversation(conversation, phoneNumber, { selectedDraw: serializeHistory(newHistory) });

    return respond(startTime);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error en chat-test:", error);
    return NextResponse.json({ success: false, error: errorMessage, stack: errorStack, duration: `${duration}ms`, messages: responseMessages }, { status: 500 });
  }
}

function respond(startTime: number) {
  return NextResponse.json({
    success: true,
    messages: responseMessages,
    locationRequested,
    duration: `${Date.now() - startTime}ms`,
  });
}

// --- Login flow (mirrors messageHandler but collects messages) ---

async function handleLoginFlow(
  phoneNumber: string,
  conversation: Conversation | null,
  state: string,
  messageType: string,
  text: string,
  latitude?: number,
  longitude?: number
): Promise<void> {
  switch (state) {
    case "new":
      collectButtons("¡Hola! 👋 Bienvenido a la Plataforma de Apuestas.\n\n¿Cómo deseas iniciar sesión?\n\n1. Ingresar con URL\n2. Usuario y contraseña");
      await createOrUpdateConversation(conversation, phoneNumber, { state: "choosing_login_method" });
      break;

    case "choosing_login_method":
      if (text === "1" || text.toLowerCase().includes("url")) {
        const sessionId = crypto.randomUUID();
        const loginUrl = `${APP_URL}/login?session=${sessionId}`;
        await createOrUpdateConversation(conversation, phoneNumber, { sessionId, state: "awaiting_login" });
        collectText(`🔗 Abre este enlace para iniciar sesión:\n\n${loginUrl}\n\nDespués de iniciar sesión, vuelve aquí y envía cualquier mensaje.`);
      } else if (text === "2" || text.toLowerCase().includes("usuario") || text.toLowerCase().includes("credencial")) {
        collectLocationRequest();
        await createOrUpdateConversation(conversation, phoneNumber, { state: "awaiting_location" });
      } else {
        collectButtons("Por favor elige una opción:\n\n1. Ingresar con URL\n2. Usuario y contraseña");
      }
      break;

    case "awaiting_location":
      if (messageType !== "location" || !latitude) {
        collectText("📍 Necesito tu ubicación para continuar. Usa el botón de compartir ubicación.");
        collectLocationRequest();
        return;
      }
      await createOrUpdateConversation(conversation, phoneNumber, {
        state: "awaiting_documento",
        betNumber: String(latitude),
        betAmount: longitude || 0,
      });
      collectText("✅ Ubicación recibida.\n\n📝 Ahora ingresa tu *número de documento* (10 dígitos):");
      break;

    case "awaiting_login":
      if (conversation?.sessionId) {
        const session = await getSessionBySessionId(conversation.sessionId);
        if (session && session.active) {
          await associatePhoneNumber(conversation.sessionId, phoneNumber);
          await createOrUpdateConversation(conversation, phoneNumber, { state: "idle" });
          collectText(`✅ ¡Sesión iniciada! Bienvenido, ${session.nombre}. 🎰\n\nAhora puedo ayudarte con tus apuestas. ¿Qué deseas hacer?`);
          return;
        }
      }
      if (text.toLowerCase() === "nuevo") {
        await createOrUpdateConversation(conversation, phoneNumber, { state: "choosing_login_method", sessionId: null });
        collectButtons("¿Cómo deseas iniciar sesión?\n\n1. Ingresar con URL\n2. Usuario y contraseña");
      } else {
        collectText("⏳ Aún no has iniciado sesión desde la web. Abre el enlace que te envié.\n\nEscribe *nuevo* para reiniciar el proceso.");
      }
      break;

    case "awaiting_documento":
      const documento = text.trim();
      if (!/^\d{10}$/.test(documento)) {
        collectText("❌ El documento debe ser de 10 dígitos. Intenta de nuevo:");
        return;
      }
      await createOrUpdateConversation(conversation, phoneNumber, { state: "awaiting_password", selectedGame: documento });
      collectText(`📋 Documento: *${documento}*\n\n🔒 Ahora ingresa tu *contraseña*:`);
      break;

    case "awaiting_password":
      const password = text.trim();
      if (!password) { collectText("🔒 Ingresa tu contraseña:"); return; }
      const doc = conversation?.selectedGame || "";
      const user = validateCredentials(doc, password);
      if (!user) {
        collectText("❌ Documento o contraseña incorrectos.\n\nIngresa tu *número de documento* (10 dígitos):");
        await createOrUpdateConversation(conversation, phoneNumber, { state: "awaiting_documento", selectedGame: null });
        return;
      }
      const lat = parseFloat(conversation?.betNumber || "0");
      const lng = conversation?.betAmount || 0;
      const session = await createNewSession({ documento: user.documento, nombre: user.nombre, latitude: lat, longitude: lng });
      await associatePhoneNumber(session.sessionId, phoneNumber);
      await createOrUpdateConversation(conversation, phoneNumber, {
        sessionId: session.sessionId, state: "idle", betNumber: null, betAmount: null, selectedGame: null,
      });
      collectText(`✅ ¡Bienvenido, ${user.nombre}! Tu sesión está activa. 🎰\n\nAhora puedo ayudarte con tus apuestas. ¿Qué deseas hacer?`);
      break;
  }
}
