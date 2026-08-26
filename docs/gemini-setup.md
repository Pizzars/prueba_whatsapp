# Configuración de Gemini AI para el Chatbot

## Obtener API Key

1. Ir a [aistudio.google.com](https://aistudio.google.com)
2. Iniciar sesión con cuenta de Google
3. Click en **"Get API Key"** → **"Create API key"**
4. Seleccionar un proyecto de Google Cloud (o crear uno nuevo)
5. Copiar la API key generada (formato: `AIzaSy...`)

## Free Tier (sin tarjeta de crédito)

| Límite | Valor |
|--------|-------|
| Requests por minuto | 15 |
| Tokens por minuto | 1,000,000 |
| Tokens por día | 1,500,000 |
| Modelo recomendado | `gemini-2.5-flash` |

Para la demo esto es más que suficiente. Si se supera, se puede pasar al plan de pago ($0.15/1M input, $0.60/1M output).

## Configuración en la App

1. Ir a `/config` en la plataforma web
2. Agregar la API key de Gemini en el campo correspondiente (se agregará a la página de config)
3. La key se guarda en DynamoDB y se lee dinámicamente

Alternativamente, se puede agregar como constante en `app/lib/constants.ts`:
```typescript
export const GEMINI_API_KEY = "AIzaSy...";
```

## Modelo a usar

- **Modelo:** `gemini-2.5-flash`
- **Razones:** más rápido, más barato, contexto de 1M tokens, excelente en español, soporta function calling
- **Alternativa:** `gemini-2.5-pro` si se necesita razonamiento más complejo ($1.25/$10 por 1M tokens)

## SDK

```bash
npm install @google/generative-ai
```

## Uso básico

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("API_KEY");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const result = await model.generateContent("Hola, ¿cómo estás?");
console.log(result.response.text());
```

## Function Calling (Tool Use)

Gemini soporta function calling nativo. Se definen "herramientas" que el modelo puede invocar:

```typescript
const tools = [{
  functionDeclarations: [{
    name: "crear_apuesta",
    description: "Registra una apuesta para el usuario",
    parameters: {
      type: "object",
      properties: {
        gameId: { type: "string", description: "ID del juego" },
        drawId: { type: "string", description: "ID del sorteo" },
        number: { type: "string", description: "Número de 4 cifras" },
        amount: { type: "number", description: "Monto entre 500 y 2000" },
      },
      required: ["gameId", "drawId", "number", "amount"],
    },
  }],
}];

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  tools,
});
```

Cuando el usuario dice "quiero apostar a chance con el 1234 por $1000", Gemini decide llamar la función `crear_apuesta` con los parámetros extraídos del mensaje.

## Variables de entorno a configurar

| Variable | Descripción |
|----------|-------------|
| `GEMINI_API_KEY` | API key de Google AI Studio |

O se configura desde `/config` en la plataforma para no redesplegar.
