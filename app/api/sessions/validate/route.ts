import { NextResponse } from "next/server";
import { validateSession } from "@/app/lib/sessions";

export async function GET(request: Request) {
  try {
    // Leer token del header Authorization
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    console.log("[validate] Token recibido:", token?.slice(0, 8) + "...");

    if (!token) {
      return NextResponse.json(
        { valid: false, reason: "Token no proporcionado" },
        { status: 401 }
      );
    }

    const session = await validateSession(token);

    console.log("[validate] Resultado:", session ? `Sesión encontrada (${session.nombre})` : "No encontrada");

    if (!session) {
      return NextResponse.json(
        { valid: false, reason: "Sesión inválida o expirada" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      session: {
        sessionId: session.sessionId,
        documento: session.documento,
        nombre: session.nombre,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error validando sesión:", error);
    return NextResponse.json(
      { valid: false, reason: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
