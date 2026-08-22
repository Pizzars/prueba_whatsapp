import { NextResponse } from "next/server";
import { validateCredentials } from "@/app/lib/users";
import crypto from "crypto";

// Clave privada para desencriptar peticiones de WhatsApp Flows
const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA34Aqvz6ktlDvMYUZKrTohhjS5fmwtIZJkFr31JlhPxOBEJRX
l5KGLeraK73EtwWCFS+3fp3kXMDc2lBW+dOi2GBGV/4Ani27qxbAzukoQR8COzVZ
5qBBuQxhssqrBP2Zu0dykUYo8ECgnZ5fzCDAG8IlOIygUqtTPC8sYyavFtG/tdBw
lPUR48+ZPpnIIO9DuIX3Zs0/4humUhyrMbvuVW/GZtx4oSVo3oG9vkqIyCTdTNJY
YNK5DVggV5R5IhbFLIYO3QRFYTPWa8VpCdDCr7Us1iMSKk47c1gB3zmN8uvSdedi
MHZnRXFUosfnF01A/di4UITmg5kF9oEhtUZYqwIDAQABAoIBAAMgkviMEtfuN/qU
Zy6+y0YdEM5g+QT9oAfiDfeukbrFNhgaS0N2rGP2FkloZVk+PXy4ZzPhV7GojS6M
0zq5qFyotDNE/ZM5Bpg1QEtk3chTe7+CVpiwg1rofnF2/n+aYM1LCaJYvffmn5i0
/5gmmSmKROUOqquddBOygUd94hNKo1bXHzc9zw2Vz0vlOO/K5z4ZQWMDXGOFfoou
ZlnH0mkJxFzokFTKcY4x0D9aqDjPP4yqEY0FZNwwDUt7tBq37yHmIU1L2fmwWfhh
ZdZWuM9WcM5iHTrIjjNr6Gi4odZJUaM8ckx+t9bQdIOc47S3GOb3p31kwIR2SZCg
mVo3bGkCgYEA9Zi2GC0ox1ju6KQ+8D9fpaZkMdaKt5pj8gY8b02Zo3dVTkyK3mDo
9WQuf1qGU8tEJGHNYJgy5seheNGhF01n4uxDN/3awM7IkrYx0OZXaM1ym/G+A72v
k+RsnxqD/wLOb4TPYnJG3+lJp2JQ/3zog07PzLkZ2zOJBO1yLgRUv+0CgYEA6PfY
KoUap/RxVWVyVy3RxW70+AS+pr4ebBTlY8MkwHAPeDGCq3XmXqQZDXzrIVDG8Dfl
63miXfmGORnpcnaXeZvBhujj7assi89vzLJA6sHOY/6ouU5ABRZJg4j0fsTMuirb
0+3rUVTQe9HMzOm7q4UA+dDcIiUf6MV0BH4yd/cCgYBDsaP/ZfMnf0vas+rlLZKf
hg137zqtANErlKxzwV/nvqy0uEROp0eO2941HC6KSiyuGocRaOIe2keXlbBhS+Sm
l5ivhjkVi+mdBrsUaWkOahJ9CVTmkxIiIYQPFq/rSkq8Uk8XQ4hlj1fN2zuYMEWm
a8K7GwoVcU8DHK+sH2V8wQKBgQDPPSJ7eJpkzAtBdxQGv0i7A+BA/R+H/tnbNZ91
ZnO8CDOKrShbVG8Qw5NRr00O/udpa6BJH5OzWzPuecF0RFCtKkQ2udeAZeQjnu0K
P4uGCc+KnlADP7utiszsiJlOZ8zi0xtoZF4PpI4th01S/50lkBR1Jjmc2j+Pdo6l
LInCswKBgQCnjyJVAsuFfJTDMqxi111vv2BLe+zt66FnGPFo9gHW10JbOUX0Q4My
YFu7in66sziKEN19FcItDoIFGV8y+/3WmJbM6ypoSa2Ne4m8WNYY8E81ioefsS8g
t5Oufti5G96vyenc+6lNfYIeX9ZirV0w5HZTp39xYp+khyOrE4Ev0w==
-----END RSA PRIVATE KEY-----`;

/**
 * Desencriptar request de WhatsApp Flows
 */
function decryptRequest(body: { encrypted_aes_key: string; encrypted_flow_data: string; initial_vector: string }) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  // Desencriptar la AES key con RSA
  const aesKey = crypto.privateDecrypt(
    {
      key: PRIVATE_KEY,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encrypted_aes_key, "base64")
  );

  // Desencriptar flow data con AES-128-GCM
  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const iv = Buffer.from(initial_vector, "base64");

  // Los últimos 16 bytes son el auth tag
  const authTag = flowDataBuffer.subarray(-16);
  const encryptedData = flowDataBuffer.subarray(0, -16);

  const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return { decryptedBody: JSON.parse(decrypted.toString("utf-8")), aesKey, iv };
}

/**
 * Encriptar response para WhatsApp Flows
 */
function encryptResponse(responseData: object, aesKey: Buffer, iv: Buffer): string {
  // Invertir el IV para la respuesta
  const flippedIv = Buffer.alloc(iv.length);
  for (let i = 0; i < iv.length; i++) {
    flippedIv[i] = ~iv[i] & 0xff;
  }

  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, flippedIv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(responseData), "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return encrypted.toString("base64");
}

/**
 * POST /api/whatsapp/flow-endpoint
 * 
 * Endpoint para WhatsApp Flows (data exchange) con encriptación E2E.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Si viene encriptado (producción)
    if (body.encrypted_flow_data) {
      const { decryptedBody, aesKey, iv } = decryptRequest(body);
      const response = processFlowRequest(decryptedBody);
      const encryptedResponse = encryptResponse(response, aesKey, iv);

      return new Response(encryptedResponse, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Si viene sin encriptar (modo draft/testing o pruebas locales)
    const response = processFlowRequest(body);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error en flow endpoint:", error);
    return NextResponse.json(
      { version: "3.0", data: { status: "error", message: String(error) } },
      { status: 500 }
    );
  }
}

/**
 * Procesar la petición del Flow (ya desencriptada)
 */
function processFlowRequest(body: { action: string; screen?: string; data?: Record<string, string>; flow_token?: string }) {
  // Health check
  if (body.action === "ping") {
    return { version: "3.0", data: { status: "active" } };
  }

  // INIT — cuando se abre el flow
  if (body.action === "INIT") {
    return {
      version: "3.0",
      screen: "LOGIN_SCREEN",
      data: {
        error_message: "",
      },
    };
  }

  // data_exchange — cuando el usuario envía datos del formulario
  if (body.action === "data_exchange") {
    const { documento, password } = body.data || {};

    const user = validateCredentials(documento || "", password || "");

    if (!user) {
      return {
        version: "3.0",
        screen: "LOGIN_SCREEN",
        data: {
          error_message: "Documento o contraseña incorrectos. Intenta de nuevo.",
        },
      };
    }

    // Login exitoso
    return {
      version: "3.0",
      screen: "SUCCESS_SCREEN",
      data: {
        nombre: user.nombre,
        documento: user.documento,
        message: `¡Bienvenido, ${user.nombre}!`,
      },
    };
  }

  return { version: "3.0", data: { status: "unknown_action" } };
}
