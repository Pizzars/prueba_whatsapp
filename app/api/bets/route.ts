import { NextResponse } from "next/server";
import { validateSession } from "@/app/lib/sessions";
import { client } from "@/app/lib/amplify-server";
import { createBet } from "@/app/lib/graphql/mutations";
import { listBets } from "@/app/lib/graphql/queries";

export async function POST(request: Request) {
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

    const body = await request.json();
    const { gameId, drawId, drawName, number, amount, source } = body;

    // Validar campos requeridos
    if (!gameId || !drawId || !drawName || !number || !amount) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos: gameId, drawId, drawName, number, amount" },
        { status: 400 }
      );
    }

    // Validar número (4 dígitos)
    if (!/^\d{4}$/.test(number)) {
      return NextResponse.json(
        { error: "El número debe ser de 4 dígitos" },
        { status: 400 }
      );
    }

    // Validar monto (500-2000)
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 500 || numAmount > 2000) {
      return NextResponse.json(
        { error: "El monto debe estar entre $500 y $2.000" },
        { status: 400 }
      );
    }

    // Crear apuesta en AppSync
    const now = new Date().toISOString();
    const input = {
      sessionId: session.sessionId,
      gameId,
      drawId,
      drawName,
      number,
      amount: numAmount,
      paidAt: now,
      source: source || "web",
      createdAt: now,
    };

    const result = await client.graphql({
      query: createBet,
      variables: { input },
    });

    const bet = (result as { data: { createBet: { id: string } } }).data.createBet;

    return NextResponse.json({
      success: true,
      betId: bet.id,
      paidAt: now,
      amount: numAmount,
    });
  } catch (error) {
    console.error("Error creando apuesta:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

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

    // Consultar apuestas por sessionId
    const result = await client.graphql({
      query: listBets,
      variables: {
        filter: { sessionId: { eq: session.sessionId } },
      },
    });

    const bets = (
      result as { data: { listBets: { items: unknown[] } } }
    ).data.listBets.items;

    return NextResponse.json({ bets });
  } catch (error) {
    console.error("Error obteniendo apuestas:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
