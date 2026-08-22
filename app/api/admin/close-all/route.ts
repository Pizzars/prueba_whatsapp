import { NextResponse } from "next/server";
import { client } from "@/app/lib/amplify-server";
import { listSessions, listConversations } from "@/app/lib/graphql/queries";
import { updateSession, updateConversation } from "@/app/lib/graphql/mutations";
import { sendText } from "@/app/lib/whatsapp/sendMessage";

/**
 * POST /api/admin/close-all — Cierra todas las sesiones activas
 * Notifica por WhatsApp a los usuarios que tengan sesión asociada.
 */
export async function POST() {
  try {
    // Obtener todas las sesiones activas
    const sessionsResult = await client.graphql({
      query: listSessions,
      variables: {
        filter: { active: { eq: true } },
        limit: 50,
      },
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

    let closed = 0;
    let notified = 0;

    for (const session of sessions) {
      // Desactivar sesión
      await client.graphql({
        query: updateSession,
        variables: {
          input: { id: session.id, active: false },
        },
      });
      closed++;

      // Si tiene phoneNumber asociado, notificar por WhatsApp
      if (session.phoneNumber) {
        try {
          await sendText(
            session.phoneNumber,
            "⚠️ Tu sesión ha sido cerrada por el administrador. Escribe cualquier mensaje para iniciar de nuevo."
          );
          notified++;
        } catch (err) {
          console.error(`Error notificando a ${session.phoneNumber}:`, err);
        }

        // Resetear la conversación asociada
        const convsResult = await client.graphql({
          query: listConversations,
          variables: {
            filter: { sessionId: { eq: session.sessionId } },
            limit: 1,
          },
        });

        const convs = (
          convsResult as {
            data: { listConversations: { items: { id: string }[] } };
          }
        ).data.listConversations.items;

        if (convs.length > 0) {
          await client.graphql({
            query: updateConversation,
            variables: {
              input: {
                id: convs[0].id,
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
        }
      }
    }

    return NextResponse.json({
      success: true,
      closed,
      notified,
      message: `${closed} sesiones cerradas, ${notified} usuarios notificados por WhatsApp.`,
    });
  } catch (error) {
    console.error("Error cerrando sesiones:", error);
    return NextResponse.json(
      { error: "Error cerrando sesiones", details: String(error) },
      { status: 500 }
    );
  }
}
