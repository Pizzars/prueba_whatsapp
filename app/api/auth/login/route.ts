import { NextResponse } from "next/server";
import { validateCredentials } from "@/app/lib/users";
import { createNewSession, associatePhoneNumber } from "@/app/lib/sessions";
import { client } from "@/app/lib/amplify-server";
import { listConversations } from "@/app/lib/graphql/queries";
import { updateConversation } from "@/app/lib/graphql/mutations";
import { sendText } from "@/app/lib/whatsapp/sendMessage";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { documento, password, latitude, longitude, sessionId } = body;

    // Validar que venga el documento
    if (!documento || typeof documento !== "string") {
      return NextResponse.json(
        { success: false, error: "Documento es requerido" },
        { status: 400 }
      );
    }

    // Validar formato (10 dígitos)
    if (!/^\d{10}$/.test(documento)) {
      return NextResponse.json(
        { success: false, error: "El documento debe ser un número de 10 dígitos" },
        { status: 400 }
      );
    }

    // Validar contraseña
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Contraseña es requerida" },
        { status: 400 }
      );
    }

    // Validar credenciales
    const user = validateCredentials(documento, password);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Documento o contraseña incorrectos" },
        { status: 401 }
      );
    }

    // Validar ubicación
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: "La ubicación es requerida" },
        { status: 400 }
      );
    }

    // Crear sesión
    const session = await createNewSession({
      documento: user.documento,
      nombre: user.nombre,
      latitude,
      longitude,
      sessionId: sessionId || undefined,
    });

    // Si viene de WhatsApp (tiene sessionId), notificar al chatbot
    if (sessionId) {
      try {
        await notifyWhatsAppLogin(sessionId, session.sessionId, user.nombre);
      } catch (err) {
        console.error("Error notificando a WhatsApp:", err);
        // No falla el login por esto
      }
    }

    return NextResponse.json({
      success: true,
      token: session.token,
      sessionId: session.sessionId,
      user: {
        nombre: user.nombre,
        documento: user.documento,
      },
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error("Error en login:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * Busca la conversación asociada al sessionId, actualiza su estado
 * y envía un mensaje de bienvenida + menú al usuario por WhatsApp.
 */
async function notifyWhatsAppLogin(
  sessionId: string,
  finalSessionId: string,
  nombre: string
) {
  // Buscar la conversación que tiene este sessionId
  const result = await client.graphql({
    query: listConversations,
    variables: {
      filter: { sessionId: { eq: sessionId } },
      limit: 1,
    },
  });

  const conversations = (
    result as {
      data: { listConversations: { items: { id: string; phoneNumber: string; sessionId: string }[] } };
    }
  ).data.listConversations.items;

  if (!conversations || conversations.length === 0) {
    console.log("No se encontró conversación para sessionId:", sessionId);
    return;
  }

  const conversation = conversations[0];
  const phoneNumber = conversation.phoneNumber;

  // Asociar el phone number a la sesión
  await associatePhoneNumber(finalSessionId, phoneNumber);

  // Actualizar estado de la conversación a idle
  await client.graphql({
    query: updateConversation,
    variables: {
      input: {
        id: conversation.id,
        state: "idle",
        updatedAt: new Date().toISOString(),
      },
    },
  });

  // Enviar mensaje de bienvenida y menú
  await sendText(
    phoneNumber,
    `✅ ¡Sesión iniciada correctamente! Bienvenido, ${nombre}.`
  );

  await sendText(
    phoneNumber,
    "¿Qué deseas hacer?\n\n1️⃣ Ver juegos disponibles\n2️⃣ Hacer una apuesta\n3️⃣ Ver mis apuestas\n4️⃣ Cerrar sesión\n\nEscribe el número de la opción."
  );
}
