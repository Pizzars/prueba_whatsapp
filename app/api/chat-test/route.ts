import { NextResponse } from "next/server";
import { processChatMessage } from "@/app/lib/ai/chatbot";

/**
 * POST /api/chat-test
 * Endpoint para probar el chatbot directamente sin WhatsApp.
 * Muestra errores completos para debugging.
 */
export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { message, phoneNumber, sessionId, history, latitude, longitude } = body;

    if (!message) {
      return NextResponse.json({ error: "message es requerido" }, { status: 400 });
    }

    const response = await processChatMessage(message, {
      phoneNumber: phoneNumber || "test-573114770120",
      sessionId: sessionId || null,
      sessionToken: null,
      latitude: latitude || null,
      longitude: longitude || null,
      history: history || [],
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      response: response.text,
      locationRequested: response.locationRequested || false,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("Error en chat-test:", error);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      stack: errorStack,
      duration: `${duration}ms`,
    }, { status: 500 });
  }
}
