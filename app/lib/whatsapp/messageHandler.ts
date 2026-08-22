import { sendText, sendLocationRequest, sendButtons } from "./sendMessage";
import { client } from "@/app/lib/amplify-server";
import { listConversations } from "@/app/lib/graphql/queries";
import {
  createConversation,
  updateConversation,
} from "@/app/lib/graphql/mutations";
import {
  createNewSession,
  validateSession,
  getSessionBySessionId,
  associatePhoneNumber,
} from "@/app/lib/sessions";
import { validateCredentials } from "@/app/lib/users";
import { generateDraws, paginateDraws } from "@/app/lib/draws";
import { formatCurrency } from "@/app/lib/formatCurrency";
import { listGames, listBets } from "@/app/lib/graphql/queries";
import { createBet } from "@/app/lib/graphql/mutations";
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
  payload: MessagePayload
): Promise<void> {
  const conversation = await getConversation(phoneNumber);
  const state = conversation?.state || "new";

  // Flujo según estado
  switch (state) {
    case "new":
      // Primera vez - pedir ubicación
      await handleNewUser(phoneNumber, conversation);
      break;

    case "awaiting_location":
      // Esperando ubicación
      await handleLocation(phoneNumber, conversation!, payload);
      break;

    case "awaiting_login":
      // Esperando que inicie sesión via web URL
      await handleAwaitingLogin(phoneNumber, conversation!, payload);
      break;

    case "awaiting_credentials":
      // Esperando documento + contraseña por WhatsApp
      await handleCredentials(phoneNumber, conversation!, payload);
      break;

    case "idle":
    case "selecting_game":
    case "selecting_draw":
    case "entering_number":
    case "entering_amount":
      // Tiene sesión activa - verificar antes
      const hasSession = conversation?.sessionId
        ? await checkActiveSession(conversation.sessionId)
        : false;

      if (!hasSession) {
        // Sesión expirada, reiniciar
        await sendText(phoneNumber, "⚠️ Tu sesión ha expirado. Vamos a iniciar de nuevo.");
        await handleNewUser(phoneNumber, conversation);
        return;
      }

      await handleAuthenticatedFlow(phoneNumber, conversation!, state, payload);
      break;

    default:
      await handleNewUser(phoneNumber, conversation);
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

// --- New user flow ---

async function handleNewUser(
  phoneNumber: string,
  conversation: Conversation | null
): Promise<void> {
  await sendText(
    phoneNumber,
    "¡Hola! 👋 Bienvenido a la Plataforma de Apuestas.\n\nPara comenzar, necesito tu ubicación."
  );

  await sendLocationRequest(
    phoneNumber,
    "📍 Comparte tu ubicación para continuar:"
  );

  await createOrUpdateConversation(conversation, phoneNumber, {
    state: "awaiting_location",
  });
}

// --- Location flow ---

async function handleLocation(
  phoneNumber: string,
  conversation: Conversation,
  payload: MessagePayload
): Promise<void> {
  if (payload.type !== "location" || !payload.location) {
    await sendText(
      phoneNumber,
      "📍 Necesito tu ubicación para continuar. Usa el botón de compartir ubicación."
    );
    await sendLocationRequest(
      phoneNumber,
      "📍 Comparte tu ubicación:"
    );
    return;
  }

  // Guardar ubicación temporalmente (la usaremos al crear la sesión)
  // La guardamos en el campo betNumber/betAmount temporalmente como lat/lng
  const { latitude, longitude } = payload.location;

  await createOrUpdateConversation(conversation, phoneNumber, {
    state: "awaiting_credentials",
    betNumber: String(latitude),
    betAmount: longitude, // Reutilizamos este campo para guardar lng
  });

  await sendText(
    phoneNumber,
    "✅ Ubicación recibida.\n\n¿Cómo deseas iniciar sesión?"
  );

  await sendButtons(phoneNumber, "Elige una opción:", [
    { id: "login_whatsapp", title: "Iniciar por aquí" },
    { id: "login_web", title: "Iniciar por Web" },
  ]);
}

// --- Awaiting credentials (login by WhatsApp) ---

async function handleCredentials(
  phoneNumber: string,
  conversation: Conversation,
  payload: MessagePayload
): Promise<void> {
  const text = payload.type === "text" ? payload.text || "" : "";
  const interactiveId = payload.type === "interactive" ? payload.interactive?.id || "" : "";

  // Si seleccionó login por web
  if (interactiveId === "login_web") {
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
    return;
  }

  // Si seleccionó login por WhatsApp
  if (interactiveId === "login_whatsapp") {
    await sendText(
      phoneNumber,
      "📝 Ingresa tu *documento* y *contraseña* separados por un espacio.\n\nEjemplo: `1023456789 1234567890`"
    );
    return;
  }

  // Intentar parsear documento + contraseña
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) {
    await sendText(
      phoneNumber,
      "❌ Formato incorrecto. Envía tu documento y contraseña separados por un espacio.\n\nEjemplo: `1023456789 1234567890`"
    );
    return;
  }

  const [documento, password] = parts;

  // Validar credenciales
  const user = validateCredentials(documento, password);
  if (!user) {
    await sendText(
      phoneNumber,
      "❌ Documento o contraseña incorrectos. Intenta de nuevo.\n\nEjemplo: `1023456789 1234567890`"
    );
    return;
  }

  // Crear sesión con la ubicación guardada
  const latitude = parseFloat(conversation.betNumber || "0");
  const longitude = conversation.betAmount || 0;

  const session = await createNewSession({
    documento: user.documento,
    nombre: user.nombre,
    latitude,
    longitude,
  });

  // Asociar phone number
  await associatePhoneNumber(session.sessionId, phoneNumber);

  // Actualizar conversación
  await createOrUpdateConversation(conversation, phoneNumber, {
    sessionId: session.sessionId,
    state: "idle",
    betNumber: null,
    betAmount: null,
  });

  await sendText(
    phoneNumber,
    `✅ ¡Bienvenido, ${user.nombre}! Tu sesión está activa.`
  );

  await sendMainMenu(phoneNumber);
}

// --- Awaiting web login ---

async function handleAwaitingLogin(
  phoneNumber: string,
  conversation: Conversation,
  payload: MessagePayload
): Promise<void> {
  if (!conversation.sessionId) {
    await handleNewUser(phoneNumber, conversation);
    return;
  }

  const session = await getSessionBySessionId(conversation.sessionId);
  if (session && session.active) {
    await associatePhoneNumber(conversation.sessionId, phoneNumber);
    await createOrUpdateConversation(conversation, phoneNumber, {
      state: "idle",
    });
    await sendText(
      phoneNumber,
      `✅ ¡Sesión iniciada correctamente! Bienvenido, ${session.nombre}.`
    );
    await sendMainMenu(phoneNumber);
    return;
  }

  const text = payload.type === "text" ? payload.text || "" : "";
  if (text.toLowerCase() === "nuevo") {
    await handleNewUser(phoneNumber, conversation);
    return;
  }

  await sendText(
    phoneNumber,
    "⏳ Aún no has iniciado sesión desde la web. Abre el enlace que te envié.\n\nEscribe *nuevo* para reiniciar el proceso."
  );
}

// --- Authenticated flow ---

async function handleAuthenticatedFlow(
  phoneNumber: string,
  conversation: Conversation,
  state: string,
  payload: MessagePayload
): Promise<void> {
  const text = payload.type === "text" ? payload.text || "" : "";
  const interactiveId = payload.type === "interactive" ? payload.interactive?.id || "" : "";

  // Comando global: "menu" vuelve al menú
  if (text.toLowerCase() === "menu" || interactiveId === "menu") {
    await createOrUpdateConversation(conversation, phoneNumber, {
      state: "idle",
      selectedGame: null,
      selectedDraw: null,
      betNumber: null,
      betAmount: null,
    });
    await sendMainMenu(phoneNumber);
    return;
  }

  switch (state) {
    case "idle":
      await handleMenu(phoneNumber, conversation, text, interactiveId);
      break;
    case "selecting_game":
      await handleSelectGame(phoneNumber, conversation, text);
      break;
    case "selecting_draw":
      await handleSelectDraw(phoneNumber, conversation, text);
      break;
    case "entering_number":
      await handleEnterNumber(phoneNumber, conversation, text);
      break;
    case "entering_amount":
      await handleEnterAmount(phoneNumber, conversation, text);
      break;
    default:
      await sendMainMenu(phoneNumber);
      break;
  }
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
  text: string,
  interactiveId: string
): Promise<void> {
  const option = interactiveId || text.trim();

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

  const gameId = conversation.selectedGame || "";
  const drawId = conversation.selectedDraw || "";
  const betNumber = conversation.betNumber || "";

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

  const gameName =
    gameId === "loteria-nacional" ? "🎰 Lotería Nacional" : "⚡ Chance Express";

  await sendText(
    phoneNumber,
    `✅ *Apuesta registrada*\n\n${gameName}\n📅 ${drawName}\n🔢 Número: ${betNumber}\n💰 Monto: ${formatCurrency(amount)}\n\n¡Buena suerte! 🍀`
  );

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
    state: "new",
    sessionId: null,
    selectedGame: null,
    selectedDraw: null,
    betNumber: null,
    betAmount: null,
  });

  await sendText(
    phoneNumber,
    "👋 Sesión cerrada. Escribe cualquier mensaje para iniciar de nuevo."
  );
}
