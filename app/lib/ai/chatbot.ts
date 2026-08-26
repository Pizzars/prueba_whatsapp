import { genAI } from "./gemini";
import { toolDeclarations } from "./tools";
import { SYSTEM_PROMPT } from "./system-prompt";
import { GEMINI_MODEL } from "@/app/lib/constants";
import { client } from "@/app/lib/amplify-server";
import { listGames, listBets } from "@/app/lib/graphql/queries";
import { createBet as createBetMutation } from "@/app/lib/graphql/mutations";
import { generateDraws } from "@/app/lib/draws";
import { formatCurrency } from "@/app/lib/formatCurrency";

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
    default:
      return JSON.stringify({ error: "Herramienta no reconocida" });
  }
}

async function execListarJuegos(): Promise<string> {
  const result = await client.graphql({ query: listGames });
  const games = (result as { data: { listGames: { items: { id: string; name: string; icon: string; description: string }[] } } })
    .data.listGames.items;
  return JSON.stringify({ success: true, games: games.map((g) => ({ id: g.id, name: g.name, icon: g.icon, description: g.description })) });
}

async function execListarSorteos(gameId: string): Promise<string> {
  const draws = generateDraws(gameId);
  return JSON.stringify({ success: true, gameId, draws: draws.map((d) => ({ id: d.id, name: d.name, hour: d.hour })) });
}

async function execCrearApuesta(args: Record<string, unknown>, context: ConversationContext): Promise<string> {
  if (!context.sessionId) return JSON.stringify({ success: false, error: "No hay sesión activa." });

  const { gameId, drawId, drawName, number, amount } = args;
  if (!/^\d{4}$/.test(number as string)) return JSON.stringify({ success: false, error: "El número debe ser de 4 cifras." });

  const numAmount = Number(amount);
  if (numAmount < 500 || numAmount > 2000) return JSON.stringify({ success: false, error: "Monto debe estar entre $500 y $2.000." });

  const now = new Date().toISOString();
  const result = await client.graphql({
    query: createBetMutation,
    variables: {
      input: {
        sessionId: context.sessionId,
        gameId,
        drawId,
        drawName,
        number,
        amount: numAmount,
        paidAt: now,
        source: "whatsapp",
        createdAt: now,
      },
    },
  });

  const bet = (result as { data: { createBet: { id: string } } }).data.createBet;
  return JSON.stringify({ success: true, betId: bet.id, message: `Apuesta registrada: ${drawName}, #${number}, ${formatCurrency(numAmount)}` });
}

async function execVerApuestas(context: ConversationContext): Promise<string> {
  if (!context.sessionId) return JSON.stringify({ success: false, error: "No hay sesión activa." });

  const result = await client.graphql({ query: listBets, variables: { limit: 50 } });
  const allBets = (result as { data: { listBets: { items: { sessionId: string; gameId: string; drawName: string; number: string; amount: number; source: string; createdAt: string }[] } } })
    .data.listBets.items;

  const userBets = allBets.filter((b) => b.sessionId === context.sessionId);
  if (userBets.length === 0) return JSON.stringify({ success: true, bets: [], message: "No hay apuestas registradas aún." });

  return JSON.stringify({
    success: true,
    total: userBets.length,
    bets: userBets.slice(0, 10).map((b) => ({
      gameId: b.gameId,
      drawName: b.drawName,
      number: b.number,
      amount: b.amount,
      source: b.source,
    })),
  });
}

// --- Main chatbot function ---

export async function processChatMessage(
  userMessage: string,
  context: ConversationContext
): Promise<ChatbotResponse> {
  const today = new Date().toISOString().split("T")[0];

  const systemInstruction = SYSTEM_PROMPT + `\n\nFecha actual: ${today}.`;

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
  });

  // Build contents from history + current message
  const contents = [
    ...context.history.map((msg) => ({
      role: msg.role === "model" ? "model" : "user",
      parts: msg.parts,
    })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  // First call
  let result = await model.generateContent({
    contents,
    tools: [{ functionDeclarations: toolDeclarations as never[] }],
  });

  let response = result.response;
  let iterations = 0;
  const maxIterations = 5;

  // Function calling loop
  while (iterations < maxIterations) {
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const functionCallPart = parts.find((p: { functionCall?: unknown }) => p.functionCall);

    if (!functionCallPart || !functionCallPart.functionCall) break;

    const { name: functionName, args: functionArgs } = functionCallPart.functionCall;

    // Execute the tool
    const toolResult = await executeTool(functionName, (functionArgs || {}) as Record<string, unknown>, context);

    // Add tool call + result to contents and ask model to respond
    contents.push({
      role: "model",
      parts: [{ text: `[Ejecuté ${functionName} → resultado: ${toolResult}]` }],
    });
    contents.push({
      role: "user",
      parts: [{ text: `Resultado de ${functionName}: ${toolResult}. Responde al usuario naturalmente basándote en esto.` }],
    });

    result = await model.generateContent({
      contents,
      tools: [{ functionDeclarations: toolDeclarations as never[] }],
    });
    response = result.response;
    iterations++;
  }

  // Extract text
  const textResponse = response.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("") || "No pude procesar tu mensaje. ¿Podrías intentar de nuevo?";

  return { text: textResponse, locationRequested: false };
}
