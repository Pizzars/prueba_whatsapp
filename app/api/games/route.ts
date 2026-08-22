import { NextResponse } from "next/server";
import { validateSession } from "@/app/lib/sessions";
import { client } from "@/app/lib/amplify-server";
import { listGames } from "@/app/lib/graphql/queries";

export async function GET(request: Request) {
  try {
    // Validar sesión
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json(
        { error: "Token no proporcionado" },
        { status: 401 }
      );
    }

    const session = await validateSession(token);
    if (!session) {
      return NextResponse.json(
        { error: "Sesión inválida o expirada" },
        { status: 401 }
      );
    }

    // Consultar juegos
    const result = await client.graphql({ query: listGames });
    const games = (result as { data: { listGames: { items: unknown[] } } }).data
      .listGames.items;

    return NextResponse.json({ games });
  } catch (error) {
    console.error("Error obteniendo juegos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
