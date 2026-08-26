import { genAI } from "./gemini";
import { tools } from "./tools";
import { SYSTEM_PROMPT } from "./system-prompt";
import { GEMINI_MODEL } from "@/app/lib/constants";
import type { Tool } from "@google/generative-ai";
import { client } from "@/app/lib/amplify-server";
import { listGames, listBets } from "@/app/lib/graphql/queries";
import { createBet as createBetMutation } from "@/app/lib/graphql/mutations";
import { generateDraws } from "@/app/lib/draws";
import { formatCurrency } from "@/app/lib/formatCurrency";
import {
  createNewSession,
  validateSession,
  getSessionBySessionId,
  associatePhoneNumber,
  deactivateSession,
} from "@/app/lib/sessions";
import { validateCredentials } from "@/app/lib/users";
import { sendLocationRequest } from "@/app/lib/whatsapp/sendMessage";
import { APP_URL } from "@/app/lib/constants";

// --- Types ---

interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

interface ConversationContext {
  phoneNumber: string;
  sessionId: string | null;
  sessionToken: string | null;
  latitude: number | null;
  longitude: number | null;
  history: ChatMessage[];
}

interface ChatbotResponse {
  text: string;
  locationRequested?: boolean;
}

// --- Tool execution ---

async function executeTool(
  functionName: string,
  args: Record<string, unknown>,
  context: ConversationContext
): Promise<string> {
  switch (functionName) {
    case "listar_juegos":
      return await execListarJuegos();

    case "listar_sorteos":
      return await execListarSorteos(args.gameId as string);

    case "crear_apuesta":
      return await execCrearApuesta(args, context);

    case "ver_apuestas":
      return await execVerApuestas(context);

    case "verificar_sesion":
      return await execVerificarSesion(context);

    case "iniciar_sesion_url":
      return await execIniciarSesionUrl(context);

    case "iniciar_sesion_credenciales":
      return await execIniciarSesionCredenciales(args, context);

    case "solicitar_ubicacion":
      return execSolicitarUbicacion(context);

    case "cerrar_sesion":
      return await execCerrarSesion(context);

    default:
      return JSON.stringify({ error: "Herramienta no reconocida" });
  }
}

async function execListarJuegos(): Promise<string> {
  const result = await client.graphql({ query: listGames });
  const games = (result as { data: { listGames: { items: { id: string; name: string; icon: string; description: string }[] } } })
    .data.listGames.items;

  return JSON.stringify({
    success: true,
    games: games.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      description: g.description,
    })),
  });
}

async function execListarSorteos(gameId: string): Promise<string> {
  const draws = generateDraws(gameId);
  return JSON.stringify({
    success: true,
    gameId,
    draws: draws.map((d) => ({
      id: d.id,
      name: d.name,
      hour: d.hour,
    })),
  });
}

async function execCrearApuesta(
  args: Record<string, unknown>,
  context: ConversationContext
): Promise<string> {
  if (!context.sessionId) {
    return JSON.stringify({ success: false, error: "No hay sesión activa. El usuario debe iniciar sesión primero." });
  }

  const { gameId, drawId, drawName, number, amount } = args;

  // Validar número
  if (!/^\d{4}$/.test(number as string)) {
    return JSON.stringify({ success: false, error: "El número debe ser de exactamente 4 cifras." });
  }

  // Validar monto
  const numAmount = Number(amount);
  if (numAmount < 500 || numAmount > 2000) {
    return JSON.stringify({ success: false, error: "El monto debe estar entre $500 y $2.000." });
  }

  const now = new Date().toISOString();
  const input = {
    sessionId: context.sessionId,
    gameId: gameId as string,
    drawId: drawId as string,
    drawName: drawName as string,
    number: number as string,
    amount: numAmount,
    paidAt: now,
    source: "whatsapp",
    createdAt: now,
  };

  const result = await client.graphql({
    query: createBetMutation,
    variables: { input },
  });

  const bet = (result as { data: { createBet: { id: string } } }).data.createBet;

  return JSON.stringify({
    success: true,
    betId: bet.id,
    message: `Apuesta registrada: ${drawName}, número ${number}, ${formatCurrency(numAmount)}`,
  });
}

async function execVerApuestas(context: ConversationContext): Promise<string> {
  if (!context.sessionId) {
    return JSON.stringify({ success: false, error: "No hay sesión activa." });
  }

  const result = await client.graphql({
    query: listBets,
    variables: { limit: 50 },
  });

  const allBets = (result as { data: { listBets: { items: { sessionId: string; gameId: string; drawName: string; number: string; amount: number; source: string; createdAt: string }[] } } })
    .data.listBets.items;

  const userBets = allBets.filter((b) => b.sessionId === context.sessionId);

  if (userBets.length === 0) {
    return JSON.stringify({ success: true, bets: [], message: "No hay apuestas registradas." });
  }

  return JSON.stringify({
    success: true,
    bets: userBets.map((b) => ({
      gameId: b.gameId,
      drawName: b.drawName,
      number: b.number,
      amount: b.amount,
      source: b.source,
      date: b.createdAt,
    })),
  });
}

async function execVerificarSesion(context: ConversationContext): Promise<string> {
  if (!context.sessionId) {
    return JSON.stringify({ active: false, message: "No hay sesión activa." });
  }

  const session = await getSessionBySessionId(context.sessionId);
  if (!session || !session.active || new Date(session.expiresAt) < new Date()) {
    return JSON.stringify({ active: false, message: "La sesión ha expirado." });
  }

  return JSON.stringify({
    active: true,
    nombre: session.nombre,
    documento: session.documento,
    expiresAt: session.expiresAt,
  });
}

async function execIniciarSesionUrl(context: ConversationContext): Promise<string> {
  const sessionId = crypto.randomUUID();
  const loginUrl = `${APP_URL}/login?session=${sessionId}`;

  return JSON.stringify({
    success: true,
    sessionId,
    loginUrl,
    message: `URL de login generada: ${loginUrl}`,
  });
}

async function execIniciarSesionCredenciales(
  args: Record<string, unknown>,
  context: ConversationContext
): Promise<string> {
  const { documento, password } = args;

  const user = validateCredentials(documento as string, password as string);
  if (!user) {
    return JSON.stringify({ success: false, error: "Documento o contraseña incorrectos." });
  }

  const latitude = context.latitude || 0;
  const longitude = context.longitude || 0;

  const session = await createNewSession({
    documento: user.documento,
    nombre: user.nombre,
    latitude,
    longitude,
  });

  await associatePhoneNumber(session.sessionId, context.phoneNumber);

  return JSON.stringify({
    success: true,
    sessionId: session.sessionId,
    token: session.token,
    nombre: user.nombre,
    message: `Sesión iniciada para ${user.nombre}.`,
  });
}

function execSolicitarUbicacion(context: ConversationContext): string {
  // Flag para que el caller envíe la solicitud de ubicación
  return JSON.stringify({
    success: true,
    action: "request_location",
    message: "Se solicitará la ubicación al usuario.",
  });
}

async function execCerrarSesion(context: ConversationContext): Promise<string> {
  if (context.sessionId) {
    await deactivateSession(context.sessionId);
  }
  return JSON.stringify({
    success: true,
    message: "Sesión cerrada.",
  });
}

// --- Main chatbot function ---

export async function processChatMessage(
  userMessage: string,
  context: ConversationContext
): Promise<ChatbotResponse> {
  const today = new Date().toISOString().split("T")[0];

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    tools: tools as unknown as Tool[],
    systemInstruction: SYSTEM_PROMPT + `\n\nFecha actual: ${today}. Teléfono del usuario: ${context.phoneNumber}. Sesión activa: ${context.sessionId ? "sí" : "no"}.`,
  });

  // Construir historial para la conversación
  const chat = model.startChat({
    history: context.history,
  });

  // Enviar mensaje del usuario
  let result = await chat.sendMessage(userMessage);
  let response = result.response;
  let locationRequested = false;

  // Loop de function calling (el modelo puede pedir ejecutar herramientas)
  while (response.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
    const functionCall = response.candidates[0].content.parts[0].functionCall;
    const functionName = functionCall.name;
    const functionArgs = (functionCall.args || {}) as Record<string, unknown>;

    // Ejecutar la herramienta
    const toolResult = await executeTool(functionName, functionArgs, context);

    // Verificar si se solicitó ubicación
    const parsed = JSON.parse(toolResult);
    if (parsed.action === "request_location") {
      locationRequested = true;
    }

    // Si fue login por credenciales exitoso, actualizar contexto
    if (functionName === "iniciar_sesion_credenciales" && parsed.success) {
      context.sessionId = parsed.sessionId;
      context.sessionToken = parsed.token;
    }

    // Si fue login por URL, actualizar sessionId
    if (functionName === "iniciar_sesion_url" && parsed.success) {
      context.sessionId = parsed.sessionId;
    }

    // Si cerró sesión, limpiar contexto
    if (functionName === "cerrar_sesion" && parsed.success) {
      context.sessionId = null;
      context.sessionToken = null;
    }

    // Enviar resultado de la herramienta al modelo
    result = await chat.sendMessage([
      {
        functionResponse: {
          name: functionName,
          response: { content: toolResult },
        },
      },
    ]);
    response = result.response;
  }

  // Extraer texto de la respuesta
  const textResponse = response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("") || "Lo siento, no pude procesar tu mensaje. ¿Podrías intentar de nuevo?";

  return {
    text: textResponse,
    locationRequested,
  };
}
