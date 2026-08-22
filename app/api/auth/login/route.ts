import { NextResponse } from "next/server";
import { validateCredentials } from "@/app/lib/users";
import { createNewSession } from "@/app/lib/sessions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { documento, password, latitude, longitude, sessionId } = body;

    // Validar que venga el documento
    if (!documento || typeof documento !== "string") {
      return NextResponse.json(
        { success: false, error: "Documento es requerido" },
        { status: 400 }
      );
    }

    // Validar formato (10 dígitos)
    if (!/^\d{10}$/.test(documento)) {
      return NextResponse.json(
        { success: false, error: "El documento debe ser un número de 10 dígitos" },
        { status: 400 }
      );
    }

    // Validar contraseña
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Contraseña es requerida" },
        { status: 400 }
      );
    }

    // Validar credenciales
    const user = validateCredentials(documento, password);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Documento o contraseña incorrectos" },
        { status: 401 }
      );
    }

    // Validar ubicación
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: "La ubicación es requerida" },
        { status: 400 }
      );
    }

    // Crear sesión
    const session = await createNewSession({
      documento: user.documento,
      nombre: user.nombre,
      latitude,
      longitude,
      sessionId: sessionId || undefined,
    });

    return NextResponse.json({
      success: true,
      token: session.token,
      sessionId: session.sessionId,
      user: {
        nombre: user.nombre,
        documento: user.documento,
      },
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error("Error en login:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
