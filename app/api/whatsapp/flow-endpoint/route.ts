import { NextResponse } from "next/server";
import { validateCredentials } from "@/app/lib/users";
import crypto from "crypto";

// Clave privada para desencriptar peticiones de WhatsApp Flows
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEwAIBADANBgkqhkiG9w0BAQEFAASCBKowggSmAgEAAoIBAQDR90ejnF5dvTit
mbAA1REdDEwhjTYj8/xwTBNjLOxl2yxZ96+lJsISHEvE9dSAGPwL+1yK8iwp9RUB
0PNFRUJRpZEXi0cFH5HqfdapXYOWpgrfa5B+d9gCVrNRePCNiLdtMxm76C/natYE
+dTerFMluMNiRpfAC73WUMCequc4NiMrNQmJA3mug8iGyqVjUSZqyPUxtim2WlU5
jht2n3+nfUFnBDO3QpqW011JWbaPwywj073Mi5kzDrY++n/V79M3qxaSlQLmpZGn
WO5AbLZiV+Zdzd3Ovd5aR3GnGGC3NoObwNtyOFJQSsoOkEVt//pM+jV57wx7knWF
pFClpf1/AgMBAAECggEBAM4a+ou0Vz2VHSnsD0UB4gatp53XzCmGu2pQg0d7NaLW
frbh1906Ko80j3wMBEiqPeBVIgaSqp+VIMXjoqmAzxTufXqrEVAKKWYRmMIwNZeP
7mRaZkB+y9+f0+5J1XhZmBTtcHlv9nYn/WZtB3R9nDEPKVwzB4tQ+0yBgFNAWDBn
y8Y32rZrk9I7Q95Q41XTPc1JBFUB3WkdEaaHp8U+OANmv3EMHjkieT9n82GvISad
YeQrbaEfoXm3/bm/vv4d6MibM9v1FFABj5Mbn4xOvbMk/1vS+fmhefnE58CEi7op
u2A3E2VNZNL/Ffo2p+P1uaR6NDSuTPQFBK7ULYMmpQECgYEA+VlC6VWXZH1031Oq
H40TkH22y6ToFe+0EoCkeZfoP/0rTpd8FYmP1vaxyhjK5RmamOtuO5jmKyXgQhHO
7kBJzb7ZcY3vBwHd7WOFlpcrw3Uib0aKY0C4RsDrnPXwBJVMIK5MG2BICphxmCjj
E0N0iJdZcjYHPzHQrz/3S9jk5SECgYEA15EVcV7mRZ8E/GvzAiASPnUrbshkHwie
CUclRAh9u+kKKl0B79Z/9lCmkeTUJKvCIOUotnjuBNkLybGhEXUwdan0wbBUfFO7
mAWTYClM4Qckve+ixOsoKpl5fq86/4vCuuEodaeTQA9xQA760R+F/nl18TEEdnMF
4eO3cXyX7p8CgYEAyG2GilZhbcYmVolCuz/EFSXn9ENmxpM59JFxI8gGSMEwuWis
tgcwFsOPX3qURJlTGk5L+h3KDa7RV2pHIl2MtZQN5ugG1WQbxoBz1ftHk0IpXrad
8HAKb90MxsstlhGH8tEHng3DerjUvlFHTamwF0dI/7QMGTDqpKPPHSmHu+ECgYEA
o2BcRg5Mq9t3pfASvzubWCbpgg7yguq/C/0V61gcIzzd7XmMLD//v6kkdVJezmQ2
v0Ou9Yz1qErvui+cCWUuEx96VwnTHl8/wFoJdkoW8D2/xQxH6sLnMFIdWLxqFJ/S
OFzJk1IsMdMCXDB+O9yOa22Wy/QAk91dSfSSZbquU7UCgYEAv8YbhL9FNj7GGmVY
TPZeNLkWOfmSndu41i5s27mHYC2EQVhd6lY83bZRN8gDl5RHRTGSqzvq3qwVyfIc
9emsNSnvoKZ8o02w7fCKbGKwtcxOdXSBR3+/+F3ShLTx5BNwTxT1TCG5a34xctuO
guisazwiqnsdmfxhqffbJ195Ygc=
-----END PRIVATE KEY-----`;

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
