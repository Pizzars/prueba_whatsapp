import { NextResponse } from "next/server";
import { client } from "@/app/lib/amplify-server";
import { listSessions, listConversations } from "@/app/lib/graphql/queries";

/**
 * GET /api/admin — Retorna sesiones y conversaciones para monitoreo
 * Query param ?history=true para ver sesiones inactivas
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const showHistory = searchParams.get("history") === "true";

    // Obtener sesiones según filtro
    const sessionsResult = await client.graphql({
      query: listSessions,
      variables: {
        filter: { active: { eq: !showHistory } },
        limit: 50,
      },
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
