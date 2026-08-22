# Arquitectura de la Plataforma

## Visión General

La plataforma es una demo de apuestas deportivas con dos interfaces de usuario:
- **Web** — aplicación Next.js con React
- **WhatsApp** — chatbot que reutiliza los mismos servicios

Ambas interfaces consumen los mismos servicios de backend. WhatsApp es un adaptador conversacional, no un sistema paralelo.

```
┌───────────────────┐
│   Plataforma Web  │──────┐
│   (Next.js Pages) │      │
└───────────────────┘      │
                           ▼
                    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
                    │  API Routes  │────▶│   AppSync    │────▶│   DynamoDB   │
                    │  (Servicios) │     │  (GraphQL)   │     │  (5 tablas)  │
                    └──────────────┘     └──────────────┘     └──────────────┘
                           ▲
┌───────────────────┐      │
│   WhatsApp Bot    │──────┘
│   (Webhook +      │
│    Adaptador)     │
└───────────────────┘
         ▲ │
         │ ▼
  ┌─────────────────┐
  │  WhatsApp Cloud  │
  │  API (Meta)      │
  └─────────────────┘
```

---

## Stack tecnológico

| Componente | Tecnología |
|-----------|-----------|
| Frontend + Backend | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| API | Next.js API Route Handlers |
| Capa de datos | AWS AppSync (GraphQL) |
| Base de datos | Amazon DynamoDB |
| Deploy | AWS Amplify |
| Mensajería | WhatsApp Business Cloud API (Meta) |
| Cliente GraphQL | aws-amplify SDK |

---

## Tablas DynamoDB

| Tabla | PK | Propósito |
|-------|-----|-----------|
| `Session_prueba_whatsapp` | `id` | Sesiones de usuario (web y WhatsApp) |
| `Game_prueba_whatsapp` | `id` | Catálogo de juegos (2 juegos seed) |
| `Bet_prueba_whatsapp` | `id` | Apuestas realizadas |
| `Conversation_prueba_whatsapp` | `id` | Estado de conversación WhatsApp |
| `Config_prueba_whatsapp` | `id` | Configuración dinámica (token WhatsApp, etc.) |

---

## API Routes (servicios)

| Ruta | Método | Descripción | Requiere sesión |
|------|--------|-------------|-----------------|
| `/api/auth/login` | POST | Login con documento + contraseña + ubicación | No |
| `/api/sessions/validate` | GET | Validar token de sesión | No (es el validador) |
| `/api/games` | GET | Listar juegos disponibles | Sí |
| `/api/draws` | GET | Listar sorteos del día (paginados) | Sí |
| `/api/bets` | POST | Crear apuesta | Sí |
| `/api/bets` | GET | Historial de apuestas | Sí |
| `/api/whatsapp/webhook` | GET | Verificación webhook Meta | No |
| `/api/whatsapp/webhook` | POST | Recibir mensajes WhatsApp | No |
| `/api/config` | GET/POST | Leer/guardar config WhatsApp | No |
| `/api/config/test-message` | POST | Enviar mensaje de prueba | No |
| `/api/admin` | GET | Listar sesiones y conversaciones | No |

---

## Cómo funciona la conexión con WhatsApp

### Envío de mensajes (App → WhatsApp)

La app envía mensajes usando la WhatsApp Cloud API de Meta:

```
POST https://graph.facebook.com/{version}/{phone_number_id}/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "{numero_destino}",
  "type": "text",
  "text": { "body": "Mensaje" }
}
```

El token, version y phone_number_id se leen dinámicamente desde DynamoDB (tabla `Config_prueba_whatsapp`). Se pueden actualizar desde `/config` sin redesplegar.

### Tipos de mensajes que la app envía:
- **Texto simple** — mensajes informativos, menú, confirmaciones
- **Solicitud de ubicación** — mensaje interactivo que muestra botón "Compartir ubicación"
- **Botones** — mensaje interactivo con opciones (ej: "Iniciar por aquí" / "Iniciar por Web")

---

## Cómo funciona el Webhook

### Configuración

Meta necesita una URL pública HTTPS que responda a:
- **GET** con el challenge de verificación
- **POST** con los mensajes entrantes

URL: `https://main.d1bz5bsylv88le.amplifyapp.com/api/whatsapp/webhook`

### Verificación (GET)

Cuando configuras el webhook en Meta, envía un GET con:
```
?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=RANDOM_STRING
```

La app valida que `hub.verify_token` coincida con el configurado y responde con el `hub.challenge`.

### Recepción de mensajes (POST)

Meta envía un POST con el payload del mensaje. La app:
1. Parsea el JSON
2. Extrae el número del remitente (`message.from`)
3. Detecta el tipo de mensaje (`text`, `location`, `interactive`)
4. Construye un payload normalizado
5. Delega al `messageHandler`
6. Responde 200 inmediatamente (el procesamiento es async)

### Estructura del payload que recibe el webhook

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "573114770120",
          "type": "text|location|interactive",
          "text": { "body": "..." },
          "location": { "latitude": 4.71, "longitude": -74.11 },
          "interactive": { "button_reply": { "id": "...", "title": "..." } }
        }]
      }
    }]
  }]
}
```

---

## Cómo funciona el Message Handler

El `messageHandler` es un adaptador conversacional que:
1. Lee el estado de la conversación desde DynamoDB
2. Según el estado, interpreta el mensaje y decide qué hacer
3. Llama a los mismos servicios que usa la plataforma web
4. Envía respuestas formateadas para WhatsApp
5. Actualiza el estado de la conversación

### Estados de conversación

| Estado | Descripción | Qué espera |
|--------|-------------|------------|
| `new` | Primera interacción | Cualquier cosa → pide ubicación |
| `awaiting_location` | Esperando ubicación | Mensaje tipo `location` |
| `awaiting_credentials` | Esperando login | Documento + contraseña, o selección de botón |
| `awaiting_login` | Esperando login web | Que el usuario complete login en la web |
| `idle` | Sesión activa, menú | Opción 1-4 |
| `selecting_game` | Eligiendo juego | Número del juego |
| `selecting_draw` | Eligiendo sorteo | Número del sorteo |
| `entering_number` | Ingresando número | 4 dígitos |
| `entering_amount` | Ingresando monto | Número entre 500-2000 |

### Principio de diseño

El messageHandler **NO** contiene lógica de negocio propia. Reutiliza:
- `lib/sessions.ts` — crear/validar sesiones
- `lib/users.ts` — validar credenciales
- `lib/draws.ts` — generar sorteos
- `lib/formatCurrency.ts` — formatear montos
- `lib/graphql/mutations.ts` — crear apuestas, conversaciones
- `lib/graphql/queries.ts` — listar juegos, apuestas

Si mañana cambias la lógica de apuestas en el servicio, WhatsApp refleja el cambio automáticamente.

---

## Configuración dinámica

La configuración de WhatsApp se almacena en DynamoDB y se lee en cada request. Esto permite:
- Actualizar el token sin redesplegar
- Cambiar el número de teléfono
- Cambiar el verify token del webhook

Se gestiona desde la página `/config` de la app.

Si no hay config en DynamoDB, la app usa valores fallback hardcoded en `app/lib/whatsapp-config.ts`.
