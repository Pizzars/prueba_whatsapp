import { NextResponse } from "next/server";
import { client } from "@/app/lib/amplify-server";
import { listSessions, listConversations } from "@/app/lib/graphql/queries";
import { updateSession, updateConversation } from "@/app/lib/graphql/mutations";
import { sendText } from "@/app/lib/whatsapp/sendMessage";

/**
 * POST /api/admin/close-all — Cierra todas las sesiones activas Y resetea todas las conversaciones
 */
export async function POST() {
  try {
    let closedSessions = 0;
    let closedConversations = 0;
    let notified = 0;

    // 1. Cerrar todas las sesiones activas
    const sessionsResult = await client.graphql({
      query: listSessions,
      variables: { limit: 50 },
    });

    const sessions = (
      sessionsResult as {
        data: {
          listSessions: {
            items: { id: string; sessionId: string; phoneNumber: string | null; active: boolean; nombre: string }[];
          };
        };
      }
    ).data.listSessions.items;

    for (const session of sessions) {
      if (session.active) {
        await client.graphql({
          query: updateSession,
          variables: { input: { id: session.id, active: false } },
        });
        closedSessions++;
      }
    }

    // 2. Resetear TODAS las conversaciones (no solo las que tienen sesión)
    const convsResult = await client.graphql({
      query: listConversations,
      variables: { limit: 50 },
    });

    const conversations = (
      convsResult as {
        data: {
          listConversations: {
            items: { id: string; phoneNumber: string; state: string; sessionId: string | null }[];
          };
        };
      }
    ).data.listConversations.items;

    for (const conv of conversations) {
      // Resetear a estado "new"
      await client.graphql({
        query: updateConversation,
        variables: {
          input: {
            id: conv.id,
            state: "new",
            sessionId: null,
            selectedGame: null,
            selectedDraw: null,
            betNumber: null,
            betAmount: null,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      closedConversations++;

      // Notificar por WhatsApp
      if (conv.phoneNumber && conv.state !== "new") {
        try {
          await sendText(
            conv.phoneNumber,
            "⚠️ Tu sesión ha sido cerrada por el administrador. Escribe cualquier mensaje para iniciar de nuevo."
          );
          notified++;
        } catch (err) {
          console.error(`Error notificando a ${conv.phoneNumber}:`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      closedSessions,
      closedConversations,
      notified,
      message: `${closedSessions} sesiones cerradas, ${closedConversations} conversaciones reseteadas, ${notified} notificados por WhatsApp.`,
    });
  } catch (error) {
    console.error("Error cerrando sesiones:", error);
    return NextResponse.json(
      { error: "Error cerrando sesiones", details: String(error) },
      { status: 500 }
    );
  }
}
