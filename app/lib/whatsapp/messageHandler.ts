import { sendText } from "./sendMessage";
import { client } from "@/app/lib/amplify-server";
import { listConversations } from "@/app/lib/graphql/queries";
import {
  createConversation,
  updateConversation,
} from "@/app/lib/graphql/mutations";
import {
  validateSession,
  getSessionBySessionId,
  associatePhoneNumber,
} from "@/app/lib/sessions";
import { generateDraws, paginateDraws } from "@/app/lib/draws";
import { formatCurrency } from "@/app/lib/formatCurrency";
import { listGames, listBets } from "@/app/lib/graphql/queries";
import { createBet } from "@/app/lib/graphql/mutations";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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
    variables: {
      filter: { phoneNumber: { eq: phoneNumber } },
      limit: 1,
    },
  });

  const items = (
    result as {
      data: { listConversations: { items: Conversation[] } };
    }
  ).data.listConversations.items;

  return items.length > 0 ? items[0] : null;
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

// --- Main handler ---

export async function handleIncomingMessage(
  phoneNumber: string,
  text: string
): Promise<void> {
  const conversation = await getConversation(phoneNumber);
  const state = conversation?.state || "idle";

  // Check if user has an active session
  const hasSession = conversation?.sessionId
    ? await checkActiveSession(conversation.sessionId)
    : false;

  if (!hasSession) {
    await handleNoSession(phoneNumber, conversation, text);
    return;
  }

  // User has active session — route based on state
  switch (state) {
    case "idle":
      await handleMenu(phoneNumber, conversation!, text);
      break;
    case "selecting_game":
      await handleSelectGame(phoneNumber, conversation!, text);
      break;
    case "selecting_draw":
      await handleSelectDraw(phoneNumber, conversation!, text);
      break;
    case "entering_number":
      await handleEnterNumber(phoneNumber, conversation!, text);
      break;
    case "entering_amount":
      await handleEnterAmount(phoneNumber, conversation!, text);
      break;
    default:
      await sendMainMenu(phoneNumber);
      await createOrUpdateConversation(conversation, phoneNumber, {
        state: "idle",
      });
      break;
  }
}

// --- Check session ---

async function checkActiveSession(sessionId: string): Promise<boolean> {
  const session = await getSessionBySessionId(sessionId);
  if (!session) return false;
  if (!session.active) return false;
  if (new Date(session.expiresAt) < new Date()) return false;
  return true;
}

// --- No session flow ---

async function handleNoSession(
  phoneNumber: string,
  conversation: Conversation | null,
  text: string
): Promise<void> {
  // If awaiting_login, check if session was created
  if (conversation?.state === "awaiting_login" && conversation.sessionId) {
    const session = await getSessionBySessionId(conversation.sessionId);
    if (session && session.active) {
      // Session created via web login — associate phone number
      await associatePhoneNumber(conversation.sessionId, phoneNumber);
      await sendText(
        phoneNumber,
        "✅ Sesión iniciada correctamente. ¡Bienvenido!"
      );
      await sendMainMenu(phoneNumber);
      await createOrUpdateConversation(conversation, phoneNumber, {
        state: "idle",
      });
      return;
    }

    // Still waiting
    await sendText(
      phoneNumber,
      "⏳ Aún no has iniciado sesión. Abre el enlace que te envié para iniciar sesión desde la web.\n\nSi necesitas un nuevo enlace, escribe *nuevo*."
    );

    if (text.toLowerCase() === "nuevo") {
      await sendLoginLink(phoneNumber, conversation);
    }
    return;
  }

  // First contact or no session — send login link
  await sendText(
    phoneNumber,
    "¡Hola! 👋 Para usar la plataforma de apuestas necesitas iniciar sesión.\n\nTe enviaré un enlace para que ingreses con tu documento."
  );
  await sendLoginLink(phoneNumber, conversation);
}

async function sendLoginLink(
  phoneNumber: string,
  conversation: Conversation | null
): Promise<void> {
  const sessionId = crypto.randomUUID();
  const loginUrl = `${APP_URL}/login?session=${sessionId}`;

  await createOrUpdateConversation(conversation, phoneNumber, {
    sessionId,
    state: "awaiting_login",
  });

  await sendText(
    phoneNumber,
    `🔗 Inicia sesión aquí:\n${loginUrl}\n\nDespués de iniciar sesión, vuelve aquí y escribe cualquier mensaje.`
  );
}

// --- Menu ---

async function sendMainMenu(phoneNumber: string): Promise<void> {
  await sendText(
    phoneNumber,
    "¿Qué deseas hacer?\n\n1️⃣ Ver juegos disponibles\n2️⃣ Hacer una apuesta\n3️⃣ Ver mis apuestas\n4️⃣ Cerrar sesión\n\nEscribe el número de la opción."
  );
}

async function handleMenu(
  phoneNumber: string,
  conversation: Conversation,
  text: string
): Promise<void> {
  const option = text.trim();

  switch (option) {
    case "1":
      await handleListGames(phoneNumber, conversation);
      break;
    case "2":
      await startBetFlow(phoneNumber, conversation);
      break;
    case "3":
      await handleListBets(phoneNumber, conversation);
      break;
    case "4":
      await handleLogout(phoneNumber, conversation);
      break;
    default:
      await sendMainMenu(phoneNumber);
      break;
  }
}

// --- List games ---

async function handleListGames(
  phoneNumber: string,
  conversation: Conversation
): Promise<void> {
  const result = await client.graphql({ query: listGames });
  const games = (
    result as {
      data: { listGames: { items: { id: string; name: string; icon: string; description: string }[] } };
    }
  ).data.listGames.items;

  if (games.length === 0) {
    await sendText(phoneNumber, "No hay juegos disponibles en este momento.");
    await sendMainMenu(phoneNumber);
    return;
  }

  let message = "🎲 *Juegos disponibles:*\n\n";
  games.forEach((game, i) => {
    message += `${i + 1}. ${game.icon} *${game.name}*\n   ${game.description}\n\n`;
  });
  message += "Escribe *menu* para volver al menú principal.";

  await sendText(phoneNumber, message);
  await createOrUpdateConversation(conversation, phoneNumber, {
    state: "idle",
  });
}

// --- Bet flow ---

async function startBetFlow(
  phoneNumber: string,
  conversation: Conversation
): Promise<void> {
  const result = await client.graphql({ query: listGames });
  const games = (
    result as {
      data: { listGames: { items: { id: string; name: string; icon: string }[] } };
    }
  ).data.listGames.items;

  let message = "🎰 *Selecciona un juego:*\n\n";
  games.forEach((game, i) => {
    message += `${i + 1}. ${game.icon} ${game.name}\n`;
  });
  message += "\nEscribe el número del juego.";

  await sendText(phoneNumber, message);
  await createOrUpdateConversation(conversation, phoneNumber, {
    state: "selecting_game",
  });
}

async function handleSelectGame(
  phoneNumber: string,
  conversation: Conversation,
  text: string
): Promise<void> {
  const result = await client.graphql({ query: listGames });
  const games = (
    result as {
      data: { listGames: { items: { id: string; name: string; icon: string }[] } };
    }
  ).data.listGames.items;

  const index = parseInt(text.trim(), 10) - 1;
  if (isNaN(index) || index < 0 || index >= games.length) {
    await sendText(
      phoneNumber,
      `❌ Opción inválida. Escribe un número del 1 al ${games.length}.`
    );
    return;
  }

  const selectedGame = games[index];
  const draws = generateDraws(selectedGame.id);
  const paginated = paginateDraws(draws, 1);

  let message = `${selectedGame.icon} *${selectedGame.name}*\n\n📅 Sorteos de hoy:\n\n`;
  paginated.draws.forEach((draw, i) => {
    const hourStr = `${String(draw.hour).padStart(2, "0")}:00`;
    message += `${i + 1}. ${hourStr}\n`;
  });
  message += "\nEscribe el número del sorteo.";

  await sendText(phoneNumber, message);
  await createOrUpdateConversation(conversation, phoneNumber, {
    state: "selecting_draw",
    selectedGame: selectedGame.id,
    currentPage: 1,
  });
}

async function handleSelectDraw(
  phoneNumber: string,
  conversation: Conversation,
  text: string
): Promise<void> {
  const gameId = conversation.selectedGame || "";
  const page = conversation.currentPage || 1;
  const draws = generateDraws(gameId);
  const paginated = paginateDraws(draws, page);

  const index = parseInt(text.trim(), 10) - 1;
  if (isNaN(index) || index < 0 || index >= paginated.draws.length) {
    await sendText(
      phoneNumber,
      `❌ Opción inválida. Escribe un número del 1 al ${paginated.draws.length}.`
    );
    return;
  }

  const selectedDraw = paginated.draws[index];

  await sendText(
    phoneNumber,
    `✅ Sorteo seleccionado: *${selectedDraw.name}*\n\n🔢 Ingresa tu número de 4 cifras:`
  );
  await createOrUpdateConversation(conversation, phoneNumber, {
    state: "entering_number",
    selectedDraw: selectedDraw.id,
  });
}

async function handleEnterNumber(
  phoneNumber: string,
  conversation: Conversation,
  text: string
): Promise<void> {
  const number = text.trim();

  if (!/^\d{4}$/.test(number)) {
    await sendText(
      phoneNumber,
      "❌ El número debe ser de exactamente 4 dígitos. Intenta de nuevo:"
    );
    return;
  }

  await sendText(
    phoneNumber,
    `🔢 Número: *${number}*\n\n💰 ¿Cuánto deseas apostar?\nMonto entre ${formatCurrency(500)} y ${formatCurrency(2000)}.\n\nEscribe solo el número (ej: 1000):`
  );
  await createOrUpdateConversation(conversation, phoneNumber, {
    state: "entering_amount",
    betNumber: number,
  });
}

async function handleEnterAmount(
  phoneNumber: string,
  conversation: Conversation,
  text: string
): Promise<void> {
  const amount = parseInt(text.trim(), 10);

  if (isNaN(amount) || amount < 500 || amount > 2000) {
    await sendText(
      phoneNumber,
      `❌ Monto inválido. Debe estar entre ${formatCurrency(500)} y ${formatCurrency(2000)}. Intenta de nuevo:`
    );
    return;
  }

  // Create the bet using the same service logic
  const gameId = conversation.selectedGame || "";
  const drawId = conversation.selectedDraw || "";
  const betNumber = conversation.betNumber || "";

  // Get draw name
  const draws = generateDraws(gameId);
  const draw = draws.find((d) => d.id === drawId);
  const drawName = draw?.name || "Sorteo";

  const now = new Date().toISOString();
  const input = {
    sessionId: conversation.sessionId || "",
    gameId,
    drawId,
    drawName,
    number: betNumber,
    amount,
    paidAt: now,
    source: "whatsapp",
    createdAt: now,
  };

  await client.graphql({
    query: createBet,
    variables: { input },
  });

  const gameName = gameId === "loteria-nacional" ? "🎰 Lotería Nacional" : "⚡ Chance Express";

  await sendText(
    phoneNumber,
    `✅ *Apuesta registrada*\n\n${gameName}\n📅 ${drawName}\n🔢 Número: ${betNumber}\n💰 Monto: ${formatCurrency(amount)}\n\n¡Buena suerte! 🍀`
  );

  // Reset state
  await createOrUpdateConversation(conversation, phoneNumber, {
    state: "idle",
    selectedGame: null,
    selectedDraw: null,
    betNumber: null,
    betAmount: null,
  });

  await sendMainMenu(phoneNumber);
}

// --- List bets ---

async function handleListBets(
  phoneNumber: string,
  conversation: Conversation
): Promise<void> {
  const sessionId = conversation.sessionId || "";

  const result = await client.graphql({
    query: listBets,
    variables: {
      filter: { sessionId: { eq: sessionId } },
      limit: 10,
    },
  });

  const bets = (
    result as {
      data: {
        listBets: {
          items: {
            drawName: string;
            number: string;
            amount: number;
            source: string;
            createdAt: string;
            gameId: string;
          }[];
        };
      };
    }
  ).data.listBets.items;

  if (bets.length === 0) {
    await sendText(phoneNumber, "📋 No tienes apuestas registradas aún.");
    await sendMainMenu(phoneNumber);
    return;
  }

  let message = "📋 *Tus últimas apuestas:*\n\n";
  bets.forEach((bet, i) => {
    const icon = bet.gameId === "loteria-nacional" ? "🎰" : "⚡";
    const src = bet.source === "web" ? "Web" : "WA";
    message += `${i + 1}. ${icon} #${bet.number} — ${bet.drawName}\n   ${formatCurrency(bet.amount)} (${src})\n\n`;
  });

  await sendText(phoneNumber, message);
  await sendMainMenu(phoneNumber);
}

// --- Logout ---

async function handleLogout(
  phoneNumber: string,
  conversation: Conversation
): Promise<void> {
  await createOrUpdateConversation(conversation, phoneNumber, {
    state: "idle",
    sessionId: null,
    selectedGame: null,
    selectedDraw: null,
    betNumber: null,
    betAmount: null,
  });

  await sendText(
    phoneNumber,
    "👋 Sesión cerrada. Para volver a usar la plataforma, escribe cualquier mensaje y te enviaré un nuevo enlace de login."
  );
}
