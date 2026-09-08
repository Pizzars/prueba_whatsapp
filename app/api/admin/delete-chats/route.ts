import { NextResponse } from "next/server";
import { client } from "@/app/lib/amplify-server";
import { listConversations } from "@/app/lib/graphql/queries";
import { deleteConversation } from "@/app/lib/graphql/mutations";

/**
 * POST /api/admin/delete-chats — Elimina TODAS las conversaciones de WhatsApp
 */
export async function POST() {
  try {
    const result = await client.graphql({
      query: listConversations,
      variables: { limit: 50 },
    });

    const conversations = (
      result as { data: { listConversations: { items: { id: string }[] } } }
    ).data.listConversations.items;

    let deleted = 0;
    for (const conv of conversations) {
      await client.graphql({
        query: deleteConversation,
        variables: { input: { id: conv.id } },
      });
      deleted++;
    }

    return NextResponse.json({
      success: true,
      deleted,
      message: `${deleted} conversaciones eliminadas.`,
    });
  } catch (error) {
    console.error("Error eliminando conversaciones:", error);
    return NextResponse.json(
      { error: "Error eliminando conversaciones", details: String(error) },
      { status: 500 }
    );
  }
}
