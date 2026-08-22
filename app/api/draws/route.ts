import { NextResponse } from "next/server";
import { validateSession } from "@/app/lib/sessions";
import { generateDraws, paginateDraws } from "@/app/lib/draws";

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

    // Leer query params
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");
    const page = parseInt(searchParams.get("page") || "1", 10);

    if (!gameId) {
      return NextResponse.json(
        { error: "gameId es requerido" },
        { status: 400 }
      );
    }

    // Generar sorteos del día y paginar
    const allDraws = generateDraws(gameId);
    const result = paginateDraws(allDraws, page);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error obteniendo sorteos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
