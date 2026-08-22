import { NextResponse } from "next/server";
import { client } from "@/app/lib/amplify-server";
import { getConfig } from "@/app/lib/graphql/queries";
import { createConfig, updateConfig } from "@/app/lib/graphql/mutations";
import { getWhatsAppConfig } from "@/app/lib/whatsapp-config";

const CONFIG_ID = "whatsapp-config";

/**
 * GET: Obtener configuración actual
 */
export async function GET() {
  try {
    const config = await getWhatsAppConfig();
    return NextResponse.json({ config });
  } catch (error) {
    console.error("Error obteniendo config:", error);
    return NextResponse.json({ error: "Error obteniendo configuración" }, { status: 500 });
  }
}

/**
 * POST: Guardar/actualizar configuración
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { whatsappToken, whatsappPhoneNumberId, whatsappVerifyToken, whatsappApiVersion, testPhoneNumber } = body;

    // Verificar si ya existe
    let exists = false;
    try {
      const result = await client.graphql({
        query: getConfig,
        variables: { id: CONFIG_ID },
      });
      const existing = (result as { data: { getConfig: unknown | null } }).data.getConfig;
      exists = !!existing;
    } catch {
      exists = false;
    }

    const input = {
      id: CONFIG_ID,
      whatsappToken: whatsappToken || "",
      whatsappPhoneNumberId: whatsappPhoneNumberId || "",
      whatsappVerifyToken: whatsappVerifyToken || "",
      whatsappApiVersion: whatsappApiVersion || "v25.0",
      testPhoneNumber: testPhoneNumber || "",
      updatedAt: new Date().toISOString(),
    };

    if (exists) {
      await client.graphql({
        query: updateConfig,
        variables: { input },
      });
    } else {
      await client.graphql({
        query: createConfig,
        variables: { input },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error guardando config:", error);
    return NextResponse.json({ error: "Error guardando configuración", details: String(error) }, { status: 500 });
  }
}
