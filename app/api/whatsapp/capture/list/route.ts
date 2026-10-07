import { NextResponse } from "next/server";
import { client } from "@/app/lib/amplify-server";
import { listWebhookCaptures } from "@/app/lib/graphql/queries";

/**
 * GET /api/whatsapp/capture/list
 * Lista las capturas del webhook para la pantalla de visualización.
 * Devuelve las más recientes primero.
 */
export async function GET() {
  try {
    const result = await client.graphql({
      query: listWebhookCaptures,
      variables: { limit: 100 },
    });

    const items = (
      result as {
        data: { listWebhookCaptures: { items: WebhookCaptureItem[] } };
      }
    ).data.listWebhookCaptures.items;

    // Más recientes primero.
    const sorted = [...items].sort((a, b) =>
      (b.receivedAt || "").localeCompare(a.receivedAt || "")
    );

    return NextResponse.json({ captures: sorted });
  } catch (error) {
    console.error("Error listando capturas:", error);
    return NextResponse.json(
      { error: "Error obteniendo capturas", details: String(error) },
      { status: 500 }
    );
  }
}

interface WebhookCaptureItem {
  id: string;
  method: string;
  receivedAt: string;
  signature: string | null;
  expectedSignature: string | null;
  signatureValid: boolean | null;
  signatureNote: string | null;
  headers: string;
  rawBody: string;
  queryString: string | null;
}
