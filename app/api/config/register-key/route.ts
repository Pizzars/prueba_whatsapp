import { NextResponse } from "next/server";
import { getWhatsAppConfig } from "@/app/lib/whatsapp-config";

// Clave pública RSA (pareja de la privada en flow-endpoint)
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0fdHo5xeXb04rZmwANUR
HQxMIY02I/P8cEwTYyzsZdssWfevpSbCEhxLxPXUgBj8C/tcivIsKfUVAdDzRUVC
UaWRF4tHBR+R6n3WqV2DlqYK32uQfnfYAlazUXjwjYi3bTMZu+gv52rWBPnU3qxT
JbjDYkaXwAu91lDAnqrnODYjKzUJiQN5roPIhsqlY1Emasj1MbYptlpVOY4bdp9/
p31BZwQzt0KaltNdSVm2j8MsI9O9zIuZMw62Pvp/1e/TN6sWkpUC5qWRp1juQGy2
YlfmXc3dzr3eWkdxpxhgtzaDm8DbcjhSUErKDpBFbf/6TPo1ee8Me5J1haRQpaX9
fwIDAQAB
-----END PUBLIC KEY-----`;

/**
 * POST /api/config/register-key
 * Registra la clave pública del negocio en WhatsApp (para Flows con endpoint).
 */
export async function POST() {
  try {
    const config = await getWhatsAppConfig();

    const url = `https://graph.facebook.com/${config.whatsappApiVersion}/${config.whatsappPhoneNumberId}/whatsapp_business_encryption`;

    const body = new URLSearchParams();
    body.append("business_public_key", PUBLIC_KEY);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.whatsappToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: "Error registrando clave pública",
        details: data,
      }, { status: response.status });
    }

    return NextResponse.json({ success: true, result: data });
  } catch (error) {
    console.error("Error registrando clave pública:", error);
    return NextResponse.json({ error: "Error interno", details: String(error) }, { status: 500 });
  }
}

/**
 * GET /api/config/register-key
 * Consulta la clave pública actualmente registrada.
 */
export async function GET() {
  try {
    const config = await getWhatsAppConfig();
    const url = `https://graph.facebook.com/${config.whatsappApiVersion}/${config.whatsappPhoneNumberId}/whatsapp_business_encryption`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.whatsappToken}` },
    });

    const data = await response.json();
    return NextResponse.json({ success: response.ok, result: data });
  } catch (error) {
    return NextResponse.json({ error: "Error interno", details: String(error) }, { status: 500 });
  }
}
