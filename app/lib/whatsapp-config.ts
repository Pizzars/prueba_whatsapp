import { client } from "./amplify-server";
import { getConfig } from "./graphql/queries";

// Fallback values (se usan si no hay config en DynamoDB)
const FALLBACK = {
  whatsappToken: "EAAM0RYkxZBZAABSYAMhQeQlu7mwmnqSFUfelMvCNRjTxV2aTOZAH7cCQ0hpwEVVohncwUoh2KdaHgZCYmdZBgpH1VZCttt8nx6sONZASDW3rpPsOZCUVtns9aRwzWxe2bZBlbBDYZA3iMLKuty2YKKGgHHGA0lF667unZCRkSQ6Fo1uUb0im68VoGqco3Do5Rjc8lO6rwZDZD",
  whatsappPhoneNumberId: "1266826483177939",
  whatsappVerifyToken: "prueba_whatsapp_verify_2024",
  whatsappApiVersion: "v25.0",
  testPhoneNumber: "573114770120",
  geminiModel: "gemini-3.5-flash-lite",
};

export interface WhatsAppConfig {
  whatsappToken: string;
  whatsappPhoneNumberId: string;
  whatsappVerifyToken: string;
  whatsappApiVersion: string;
  testPhoneNumber: string;
  geminiModel: string;
}

const CONFIG_ID = "whatsapp-config";

/**
 * Obtiene la configuración de WhatsApp desde DynamoDB.
 * Si no existe, retorna los valores por defecto.
 */
export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  try {
    const result = await client.graphql({
      query: getConfig,
      variables: { id: CONFIG_ID },
    });

    const config = (result as { data: { getConfig: WhatsAppConfig | null } })
      .data.getConfig;

    if (!config) {
      return FALLBACK;
    }

    return {
      whatsappToken: config.whatsappToken || FALLBACK.whatsappToken,
      whatsappPhoneNumberId: config.whatsappPhoneNumberId || FALLBACK.whatsappPhoneNumberId,
      whatsappVerifyToken: config.whatsappVerifyToken || FALLBACK.whatsappVerifyToken,
      whatsappApiVersion: config.whatsappApiVersion || FALLBACK.whatsappApiVersion,
      testPhoneNumber: config.testPhoneNumber || FALLBACK.testPhoneNumber,
      geminiModel: (config as unknown as { geminiModel?: string }).geminiModel || FALLBACK.geminiModel,
    };
  } catch (error) {
    console.error("Error obteniendo config de WhatsApp, usando fallback:", error);
    return FALLBACK;
  }
}
