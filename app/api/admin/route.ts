import { NextResponse } from "next/server";
import { client } from "@/app/lib/amplify-server";
import { listSessions, listConversations } from "@/app/lib/graphql/queries";

/**
 * GET /api/admin — Retorna sesiones y conversaciones para monitoreo
 * Sin validación de sesión (es un endpoint admin para la demo)
 */
export async function GET() {
  try {
    // Obtener sesiones
    const sessionsResult = await client.graphql({
      query: listSessions,
      variables: { limit: 50 },
    });
    const sessions = (
      sessionsResult as {
        data: { listSessions: { items: unknown[] } };
      }
    ).data.listSessions.items;

    // Obtener conversaciones
    const convsResult = await client.graphql({
      query: listConversations,
      variables: { limit: 50 },
    });
    const conversations = (
      convsResult as {
        data: { listConversations: { items: unknown[] } };
      }
    ).data.listConversations.items;

    return NextResponse.json({ sessions, conversations });
  } catch (error) {
    console.error("Error en admin:", error);
    return NextResponse.json(
      { error: "Error obteniendo datos", details: String(error) },
      { status: 500 }
    );
  }
}
