import { NextResponse } from "next/server";
import { validateCredentials } from "@/app/lib/users";

/**
 * POST /api/whatsapp/flow-endpoint
 * 
 * Endpoint para WhatsApp Flows (data exchange).
 * El Flow test_login enviará las credenciales aquí para validar.
 * 
 * NOTA: En producción, las peticiones de WhatsApp Flows llegan encriptadas
 * con AES-128-GCM y necesitas desencriptarlas con tu clave privada RSA.
 * Para esta demo, también aceptamos requests sin encriptar (para pruebas).
 * 
 * WhatsApp Flows envía:
 * {
 *   "version": "3.0",
 *   "action": "data_exchange",
 *   "screen": "LOGIN_SCREEN",
 *   "data": { "documento": "...", "password": "..." }
 * }
 * 
 * Respuesta esperada:
 * {
 *   "version": "3.0",
 *   "screen": "SUCCESS_SCREEN" | "ERROR_SCREEN",
 *   "data": { ... }
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Si es un health check de Meta
    if (body.action === "ping") {
      return NextResponse.json({
        version: "3.0",
        data: { status: "active" },
      });
    }

    // Manejar INIT (cuando se abre el flow)
    if (body.action === "INIT") {
      return NextResponse.json({
        version: "3.0",
        screen: "LOGIN_SCREEN",
        data: {
          error_message: "",
        },
      });
    }

    // Manejar data_exchange (cuando el usuario envía datos)
    if (body.action === "data_exchange") {
      const { documento, password } = body.data || {};

      // Validar credenciales
      const user = validateCredentials(documento, password);

      if (!user) {
        return NextResponse.json({
          version: "3.0",
          screen: "LOGIN_SCREEN",
          data: {
            error_message: "Documento o contraseña incorrectos",
          },
        });
      }

      // Login exitoso — retornar pantalla de éxito
      // El flow se cerrará y el webhook recibirá la respuesta
      return NextResponse.json({
        version: "3.0",
        screen: "SUCCESS_SCREEN",
        data: {
          nombre: user.nombre,
          documento: user.documento,
          success: true,
        },
      });
    }

    // Acción no reconocida
    return NextResponse.json({
      version: "3.0",
      data: { status: "unknown_action" },
    });
  } catch (error) {
    console.error("Error en flow endpoint:", error);
    return NextResponse.json(
      { version: "3.0", data: { status: "error" } },
      { status: 500 }
    );
  }
}
