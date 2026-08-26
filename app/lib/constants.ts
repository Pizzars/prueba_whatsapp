// ============================================================
// CONSTANTES DE CONFIGURACIÓN - Demo prueba_whatsapp
// En una app real esto iría en variables de entorno.
// Para esta demo se dejan hardcoded para simplicidad.
// ============================================================

// --- AppSync ---
export const APPSYNC_ENDPOINT = "https://nacdrra6kvcgdgfl6vvrvxbs5i.appsync-api.us-east-1.amazonaws.com/graphql";
export const APPSYNC_API_KEY = "da2-hkrvgcesznby3dxfbuedq5gepy";
export const AWS_REGION = "us-east-1";

// --- WhatsApp Business API ---
export const WHATSAPP_TOKEN = "EAAM0RYkxZBZAABSYAMhQeQlu7mwmnqSFUfelMvCNRjTxV2aTOZAH7cCQ0hpwEVVohncwUoh2KdaHgZCYmdZBgpH1VZCttt8nx6sONZASDW3rpPsOZCUVtns9aRwzWxe2bZBlbBDYZA3iMLKuty2YKKGgHHGA0lF667unZCRkSQ6Fo1uUb0im68VoGqco3Do5Rjc8lO6rwZDZD";
export const WHATSAPP_PHONE_NUMBER_ID = "1266826483177939";
export const WHATSAPP_VERIFY_TOKEN = "prueba_whatsapp_verify_2024";
export const WHATSAPP_API_VERSION = "v25.0";
export const WHATSAPP_API_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

// --- App ---
export const APP_URL = "https://main.d1bz5bsylv88le.amplifyapp.com";

// --- WhatsApp Flow ---
export const WHATSAPP_FLOW_ID = "1557723995248929";
export const WHATSAPP_FLOW_MODE = "draft"; // cambiar a "published" cuando se publique

// --- Gemini AI ---
export const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
export const GEMINI_MODEL = "gemini-2.5-flash-preview-05-20";
