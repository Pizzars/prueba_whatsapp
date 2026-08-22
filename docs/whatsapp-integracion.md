# Integración con WhatsApp Business API

## Resumen

La plataforma se conecta con WhatsApp Business Cloud API de Meta para ofrecer un chatbot conversacional que permite a los usuarios iniciar sesión, ver juegos, hacer apuestas y consultar su historial directamente desde WhatsApp.

WhatsApp actúa como un **segundo cliente** que reutiliza los mismos servicios del backend (API Routes). No tiene lógica de negocio propia.

---

## Configuración Inicial

### 1. Crear App en Meta for Developers

1. Ir a [developers.facebook.com](https://developers.facebook.com)
2. Crear una app de tipo **Business**
3. Agregar el producto **WhatsApp**
4. En WhatsApp → API Setup → copiar:
   - **Phone Number ID** (número de WhatsApp Business)
   - **Token temporal** (dura 24h) o generar un token de sistema permanente

### 2. Configurar Webhook

En Meta → WhatsApp → Configuration → Webhooks:

- **Callback URL:** `https://main.d1bz5bsylv88le.amplifyapp.com/api/whatsapp/webhook`
- **Verify Token:** `prueba_whatsapp_verify_2024` (o el que configures en `/config`)
- **Suscripciones:** marcar `messages`

### 3. Configurar en la App

Ir a `/config` en la plataforma web y llenar:

| Campo | Descripción |
|-------|-------------|
| WhatsApp Token | Token de acceso (temporal 24h o permanente) |
| Phone Number ID | ID del número de WhatsApp Business |
| Verify Token | El mismo que se puso en Meta (webhook) |
| API Version | `v25.0` (o la versión actual) |
| Número de pruebas | Número con código de país para recibir mensajes (ej: `573114770120`) |

La configuración se guarda en DynamoDB y se lee dinámicamente en cada request. **No necesitas redesplegar para cambiar el token.**

### 4. Agregar números de prueba

En modo desarrollo (app no publicada), solo los números agregados como testers en Meta reciben webhooks. Ve a Meta → WhatsApp → API Setup → agrega tu número de prueba.

---

## Webhook

**Endpoint:** `/api/whatsapp/webhook`

### Verificación (GET)

Meta envía un GET para verificar el webhook:
```
GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
```
La app valida el token y responde con el challenge.

### Mensajes entrantes (POST)

Meta envía un POST con el payload del mensaje. La app:
1. Parsea el JSON del payload
2. Extrae `phoneNumber` y tipo de mensaje
3. Normaliza el payload (texto, ubicación, interactivo)
4. Delega al `messageHandler`
5. Responde 200 inmediatamente (procesamiento async)

### Tipos de mensaje soportados

| Tipo | Campo | Uso |
|------|-------|-----|
| `text` | `message.text.body` | Respuestas de texto libre |
| `location` | `message.location.{latitude,longitude}` | Ubicación del usuario |
| `interactive` | `message.interactive.button_reply.{id,title}` | Respuesta a botones |

### Ejemplo de payload recibido (texto)
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "573114770120",
          "type": "text",
          "text": { "body": "Hola" }
        }]
      }
    }]
  }]
}
```

### Ejemplo de payload recibido (ubicación)
```json
{
  "messages": [{
    "from": "573114770120",
    "type": "location",
    "location": {
      "latitude": 4.7119488716125,
      "longitude": -74.116989135742
    }
  }]
}
```

---

## Flujo Conversacional

### Diagrama de estados

```
[new] ──saluda──▶ [choosing_login_method]
                         │
          ┌──────────────┼──────────────┐
          ▼                             ▼
   "Ingresar con URL"          "Usuario y contraseña"
          │                             │
          ▼                             ▼
  [awaiting_login]             [awaiting_location]
     (envía URL)                  (pide ubicación)
          │                             │
     login web                     comparte ubicación
          │                             │
          ▼                             ▼
       [idle]                  [awaiting_documento]
                                   (pide documento)
                                        │
                                   envía documento
                                        │
                                        ▼
                               [awaiting_password]
                                  (pide contraseña)
                                        │
                                   envía contraseña
                                        │
                                        ▼
                                     [idle]

[idle] ──── Menú principal ────
  │
  ├── "1" → Ver juegos → [idle]
  ├── "2" → [selecting_game] → [selecting_draw] → [entering_number] → [entering_amount] → apuesta → [idle]
  ├── "3" → Ver apuestas → [idle]
  └── "4" → Cerrar sesión → [new]

Comandos globales (cualquier estado):
  "terminar" → cierra sesión → [new]
  "menu" → vuelve a [idle] (si tiene sesión activa)
```

### Flujo 1: Login con URL

1. Usuario saluda → bot ofrece 2 opciones (botones interactivos)
2. Elige "Ingresar con URL"
3. Bot genera UUID como sessionId y envía URL: `https://app.amplifyapp.com/login?session={uuid}`
4. Estado: `awaiting_login`
5. Usuario abre URL → hace login en la web (documento + contraseña + ubicación)
6. La API Route de login detecta el `sessionId`, busca la conversación en DynamoDB, la actualiza a `idle`, y envía automáticamente un mensaje de bienvenida + menú por WhatsApp
7. El usuario ya puede interactuar sin necesidad de escribir algo en el chat

### Flujo 2: Login con credenciales por chat

1. Elige "Usuario y contraseña"
2. Bot solicita ubicación (mensaje interactivo con botón "Compartir ubicación")
3. Estado: `awaiting_location`
4. Usuario comparte ubicación → bot la guarda
5. Bot pide documento (10 dígitos)
6. Estado: `awaiting_documento`
7. Usuario envía documento → bot lo valida y pide contraseña
8. Estado: `awaiting_password`
9. Usuario envía contraseña → bot valida credenciales
10. Si correcto → crea sesión con ubicación → menú principal
11. Si incorrecto → pide documento de nuevo

### Sesión expirada

Si el usuario intenta interactuar con sesión vencida (1 hora de vigencia):
- Bot: "⚠️ Tu sesión ha expirado. Necesitas iniciar sesión nuevamente."
- Muestra botones de login directamente (sin saludo de bienvenida)

### Cierre de sesión

Al cerrar sesión (opción 4 o "terminar"):
- Se desactiva la sesión en DynamoDB (`active: false`)
- Bot: "👋 ¡Gracias por usar la Plataforma de Apuestas! Tu sesión ha sido cerrada. ¡Te esperamos pronto!"
- Estado vuelve a `new`

---

## Envío de Mensajes

### Tipos de mensaje que la app envía

| Tipo | Función | Uso |
|------|---------|-----|
| Texto simple | `sendText()` | Menú, confirmaciones, errores |
| Solicitud de ubicación | `sendLocationRequest()` | Pedir ubicación al usuario |
| Botones interactivos | `sendButtons()` | Opciones de login, confirmaciones |
| Listas interactivas | `sendList()` | (Disponible, no usado actualmente) |
| WhatsApp Flow | `sendFlow()` | Login con formulario (requiere Business verificado) |

### Endpoint de envío

```
POST https://graph.facebook.com/{version}/{phone_number_id}/messages
Authorization: Bearer {token}
Content-Type: application/json
```

Los valores de `version`, `phone_number_id` y `token` se leen dinámicamente desde la tabla `Config_prueba_whatsapp` en DynamoDB.

---

## WhatsApp Flows (Formularios)

### Estado actual

WhatsApp Flows permite mostrar formularios nativos dentro del chat (como un mini-app). Se intentó implementar un flow `test_login` para el login con formulario, pero requiere **Business Portfolio verificado** en Meta, lo cual no está disponible para esta demo.

### Qué se implementó

- **Endpoint para data exchange:** `/api/whatsapp/flow-endpoint`
  - Maneja encriptación end-to-end (RSA + AES-128-GCM)
  - Procesa acciones: `ping`, `INIT`, `data_exchange`
  - Valida credenciales y responde con pantalla SUCCESS o error

- **Claves RSA generadas:**
  - Pública: se registra en Meta vía API
  - Privada: embebida en el código del endpoint

- **Flow ID:** `1557723995248929`

- **Función `sendFlow()`** disponible en `sendMessage.ts` para enviar flows cuando esté habilitado

### Para activar Flows en el futuro

1. Verificar Business Portfolio en Meta
2. El endpoint ya está listo (`/api/whatsapp/flow-endpoint`)
3. Las claves ya están registradas
4. El JSON del flow está definido (2 pantallas: SIGN_IN → SUCCESS)
5. Solo necesitas descomentar el envío del flow en `handleLocation` del messageHandler

### Registrar clave pública (si se necesita renovar)

```bash
curl -X POST \
  'https://graph.facebook.com/v25.0/{PHONE_NUMBER_ID}/whatsapp_business_encryption' \
  -H 'Authorization: Bearer {TOKEN}' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'business_public_key=-----BEGIN PUBLIC KEY-----
...clave...
-----END PUBLIC KEY-----'
```

### JSON del Flow (para Meta)

```json
{
  "version": "7.3",
  "data_api_version": "3.0",
  "routing_model": {
    "SIGN_IN": ["SUCCESS"]
  },
  "screens": [
    {
      "id": "SIGN_IN",
      "title": "Iniciar sesión",
      "data": {
        "error_message": { "type": "string", "__example__": "" }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [{
          "type": "Form",
          "name": "sign_in_form",
          "children": [
            { "type": "TextInput", "required": true, "label": "Documento", "name": "documento", "input-type": "number", "helper-text": "10 dígitos" },
            { "type": "TextInput", "required": true, "label": "Contraseña", "name": "password", "input-type": "password" },
            { "type": "TextBody", "text": "${data.error_message}" },
            { "type": "Footer", "label": "Ingresar", "on-click-action": { "name": "data_exchange", "payload": { "documento": "${form.documento}", "password": "${form.password}" } } }
          ]
        }]
      }
    },
    {
      "id": "SUCCESS",
      "title": "Bienvenido",
      "terminal": true,
      "success": true,
      "data": {
        "nombre": { "type": "string", "__example__": "Carlos Martínez" },
        "message": { "type": "string", "__example__": "Sesión iniciada" }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          { "type": "TextHeading", "text": "✅ ${data.message}" },
          { "type": "TextBody", "text": "Bienvenido, ${data.nombre}. Puedes cerrar esta ventana y continuar en el chat." },
          { "type": "Footer", "label": "Continuar", "on-click-action": { "name": "complete", "payload": { "nombre": "${data.nombre}" } } }
        ]
      }
    }
  ]
}
```

---

## Monitoreo y Administración

### Página de monitoreo (`/monitor`)

Muestra en tiempo real:
- **Conversaciones:** teléfono, estado actual con etiqueta legible, progreso de apuesta
- **Sesiones activas:** nombre, documento, ubicación, vigencia, tiempo restante
- **Historial:** sesiones cerradas o expiradas (tab separado)

### Botón "Cerrar todas"

Cierra todas las sesiones activas de una vez:
- Marca cada sesión como `active: false`
- Envía mensaje por WhatsApp a cada usuario con sesión asociada
- Resetea la conversación de WhatsApp a estado `new`

### Página de configuración (`/config`)

Permite actualizar sin redesplegar:
- Token de WhatsApp
- Phone Number ID
- Verify Token
- API Version
- Número de pruebas
- Botón para enviar mensaje de prueba

---

## Ubicación

### Solicitud de ubicación

La app envía un mensaje interactivo tipo `location_request_message` que muestra un botón "Compartir ubicación" al usuario.

### Limitaciones

- WhatsApp Cloud API **solo soporta ubicación estática** (un punto)
- No hay forma de solicitar ubicación en tiempo real
- El usuario puede enviar ubicación falsa usando apps de terceros
- Para una demo es aceptable; en producción se necesitarían otros mecanismos de validación

### Validación

Si el usuario envía algo que no es ubicación mientras el estado es `awaiting_location`, el bot responde que necesita la ubicación y reenvía el botón.

---

## Tokens y Expiración

| Elemento | Duración |
|----------|----------|
| Token temporal de Meta | 24 horas |
| Token de sistema (permanente) | No expira |
| Sesión de usuario | 1 hora |

### Renovar token temporal

1. Ir a Meta → WhatsApp → API Setup → "Generate" (nuevo token temporal)
2. Ir a `/config` en la app → pegar nuevo token → Guardar
3. Probar con botón "Enviar mensaje de prueba"

### Token permanente

Para evitar renovar cada 24h:
1. Meta → Business Settings → System users → crear system user
2. Asignar permisos `whatsapp_business_messaging`
3. Generar token → ese no expira

---

## Pruebas con Postman

### Enviar mensaje de texto
```
POST https://graph.facebook.com/v25.0/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "573114770120",
  "type": "text",
  "text": { "body": "Mensaje de prueba" }
}
```

### Simular webhook (texto)
```
POST http://localhost:3000/api/whatsapp/webhook
Content-Type: application/json

{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "messages": [{
          "from": "573114770120",
          "type": "text",
          "text": { "body": "Hola" }
        }]
      }
    }]
  }]
}
```

### Simular webhook (ubicación)
```
POST http://localhost:3000/api/whatsapp/webhook
Content-Type: application/json

{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "messages": [{
          "from": "573114770120",
          "type": "location",
          "location": { "latitude": 4.711, "longitude": -74.116 }
        }]
      }
    }]
  }]
}
```

### Simular webhook (botón interactivo)
```
POST http://localhost:3000/api/whatsapp/webhook
Content-Type: application/json

{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "messages": [{
          "from": "573114770120",
          "type": "interactive",
          "interactive": {
            "type": "button_reply",
            "button_reply": { "id": "login_whatsapp", "title": "Usuario y contraseña" }
          }
        }]
      }
    }]
  }]
}
```

---

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `app/api/whatsapp/webhook/route.ts` | Webhook (verificación + recepción de mensajes) |
| `app/api/whatsapp/flow-endpoint/route.ts` | Endpoint para WhatsApp Flows (data exchange encriptado) |
| `app/lib/whatsapp/messageHandler.ts` | Adaptador conversacional (estados + lógica de flujo) |
| `app/lib/whatsapp/sendMessage.ts` | Funciones para enviar mensajes vía API |
| `app/lib/whatsapp-config.ts` | Lee configuración dinámica desde DynamoDB |
| `app/lib/constants.ts` | Valores fallback hardcoded |
| `app/config/page.tsx` | UI para gestionar configuración |
| `app/monitor/page.tsx` | UI para monitorear sesiones y conversaciones |
