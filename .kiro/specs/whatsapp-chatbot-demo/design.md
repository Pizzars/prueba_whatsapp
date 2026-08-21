# Diseño Técnico - Demo WhatsApp Chatbot de Apuestas

## Arquitectura General

```
┌─────────────────────────────┐     ┌──────────────┐     ┌──────────────┐
│  Next.js (App Router)       │────▶│   AppSync    │────▶│   DynamoDB   │
│  - Pages (React SSR/CSR)    │     │  (GraphQL)   │     │  (4 tablas)  │
│  - API Route Handlers       │     └──────────────┘     └──────────────┘
│                             │
│  Deploy: AWS Amplify        │
└─────────────────────────────┘
            ▲       │
            │       ▼
      ┌─────────────────┐
      │  WhatsApp Cloud  │
      │  API (Meta)      │
      └─────────────────┘
```

### Flujo de datos
- **Frontend** → llama a API Routes de Next.js (fetch a `/api/...`)
- **API Routes** → consultan/escriben datos a través de AppSync GraphQL (usando `aws-amplify` SDK)
- **AppSync** → resuelve queries/mutations con resolvers JS que leen/escriben en DynamoDB
- **WhatsApp webhook** → llega a API Route → procesa → consulta AppSync → responde vía WhatsApp API

---

## Estructura del Proyecto (Next.js App Router)

```
app/
├── layout.tsx                    # Layout principal
├── page.tsx                      # Dashboard (juegos y apuestas)
├── globals.css                   # Estilos globales
├── login/
│   ├── page.tsx                  # Pantalla de login con geolocalización
│   └── success/
│       └── page.tsx              # Pantalla post-login (volver a WhatsApp)
├── api/
│   ├── sessions/
│   │   └── route.ts             # POST: crear sesión | GET: validar sesión
│   ├── bets/
│   │   └── route.ts             # POST: crear apuesta | GET: obtener historial
│   ├── draws/
│   │   └── route.ts             # GET: obtener sorteos paginados
│   ├── games/
│   │   └── route.ts             # GET: obtener catálogo de juegos
│   └── whatsapp/
│       └── webhook/
│           └── route.ts         # GET: verificación | POST: mensajes entrantes
├── components/
│   ├── GameCard.tsx              # Tarjeta de juego
│   ├── DrawList.tsx              # Lista de sorteos
│   ├── BetForm.tsx               # Formulario de apuesta (flujo secuencial)
│   └── BetHistory.tsx            # Historial de apuestas
└── lib/
    ├── amplify-server.ts         # Configuración de Amplify + cliente GraphQL
    ├── graphql/
    │   ├── queries.ts            # Queries GraphQL (get*, list*)
    │   └── mutations.ts          # Mutations GraphQL (create*, update*, delete*)
    ├── sessions.ts               # Lógica de sesiones (crear, validar)
    ├── draws.ts                  # Generador de sorteos ficticios
    ├── whatsapp/
    │   ├── sendMessage.ts        # Enviar mensajes vía WhatsApp API
    │   └── messageHandler.ts     # Procesar mensajes entrantes y estado
    └── formatCurrency.ts         # Utilidad para formato de moneda

aws-exports.js                    # Config de AppSync (endpoint, apiKey, region)
schema.graphql                    # Schema GraphQL de AppSync
scripts/
├── create-tables.sh              # Crear tablas DynamoDB vía AWS CLI
├── deploy-resolvers.sh           # Desplegar resolvers en AppSync vía AWS CLI
├── seed-games.sh                 # Insertar juegos de prueba
└── resolvers/                    # Código JS de los resolvers de AppSync
    ├── getItem.js
    ├── listItems.js
    ├── createItem.js
    ├── updateItem.js
    └── deleteItem.js
docs/
└── setup-appsync-cli.md          # Guía completa de setup de infraestructura
```

---

## Capa de Datos: AppSync GraphQL

### Configuración del cliente (`app/lib/amplify-server.ts`)

```typescript
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";

Amplify.configure({
  API: {
    GraphQL: {
      endpoint: process.env.APPSYNC_ENDPOINT,
      region: process.env.AWS_REGION || "us-east-1",
      defaultAuthMode: "apiKey",
      apiKey: process.env.APPSYNC_API_KEY,
    },
  },
});

export const client = generateClient();
```

### Uso desde API Routes

```typescript
import { client } from "@/app/lib/amplify-server";
import { listGames } from "@/app/lib/graphql/queries";
import { createBet } from "@/app/lib/graphql/mutations";

// Leer
const result = await client.graphql({ query: listGames });

// Escribir
const result = await client.graphql({
  query: createBet,
  variables: { input: { sessionId, gameId, ... } }
});
```

### Schema GraphQL (en AppSync)

Tipos principales:
- `Session_prueba_whatsapp` — Sesiones de usuario
- `Game_prueba_whatsapp` — Catálogo de juegos
- `Bet_prueba_whatsapp` — Apuestas realizadas
- `Conversation_prueba_whatsapp` — Estado de conversación WhatsApp

Operaciones disponibles:
- Queries: `getSession`, `listSessions`, `getGame`, `listGames`, `getBet`, `listBets`, `getConversation`, `listConversations`
- Mutations: `createSession`, `updateSession`, `deleteSession`, `createGame`, `createBet`, `createConversation`, `updateConversation`
- Subscriptions: `onCreateBet` (por sessionId)

### Resolvers de AppSync

Se usan resolvers JavaScript (runtime APPSYNC_JS 1.0.0):
- **getItem.js** — GetItem por ID
- **listItems.js** — Scan con paginación (limit + nextToken)
- **createItem.js** — PutItem con auto-generación de ID
- **updateItem.js** — UpdateItem usando `ddb.update()` de `@aws-appsync/utils/dynamodb`
- **deleteItem.js** — DeleteItem por ID

> Nota: El runtime JS de AppSync no soporta `Object.entries()` ni todas las APIs de ES6. Para updates se usa el helper `ddb.update()` del módulo `@aws-appsync/utils/dynamodb`.

---

## Frontend (Next.js Pages)

### Routing (App Router)
- `/login?session=<sessionId>` → Pantalla de Login (Client Component)
- `/login/success?session=<sessionId>` → Pantalla post-login
- `/` → Dashboard (juegos y apuestas)

### Generación de Sorteos
- Función determinística que genera sorteos basados en la fecha actual.
- Cada hora del día (de 8:00 a 22:00) tiene un sorteo.
- Nombres ficticios: "Sorteo de las 8:00", "Sorteo de las 9:00", etc.
- ID generado como hash de fecha + hora.
- Lógica compartida en `app/lib/draws.ts` (usada tanto por frontend como por API Routes).

---

## Backend (API Route Handlers)

### Detalle de Endpoints

#### 1. `POST /api/sessions` - Crear Sesión
- **Input**: `{ sessionId, location: { latitude, longitude } }`
- **Proceso**:
  1. Genera token de autenticación (`crypto.randomUUID()`).
  2. Calcula expiración (createdAt + 24h).
  3. Llama a AppSync mutation `createSession`.
- **Output**: `{ success: true, token, expiresAt, sessionId }`

#### 2. `GET /api/sessions?sessionId=xxx` - Validar Sesión
- **Input**: Query param `sessionId`
- **Proceso**:
  1. Llama a AppSync query `listSessions` con filtro `sessionId.eq`.
  2. Verifica que esté activa y no haya expirado.
- **Output**: `{ valid: true, session: {...} }` o `{ valid: false, reason: "expired|not_found" }`

#### 3. `GET /api/whatsapp/webhook` - Verificación de Webhook
- Valida `hub.verify_token` contra token configurado.
- Responde con `hub.challenge`.

#### 4. `POST /api/whatsapp/webhook` - Mensajes Entrantes
- Parsea el mensaje de WhatsApp.
- Extrae número de teléfono del remitente.
- Delega al `messageHandler`.

#### 5. `GET /api/draws?page=1&gameId=game1&sessionId=xxx` - Obtener Sorteos
- **Proceso**:
  1. Valida sesión activa (vía AppSync).
  2. Genera sorteos del día actual (en memoria, no DB).
  3. Pagina en bloques de 10.
- **Output**: `{ draws: [...], page, totalPages, hasMore }`

#### 6. `POST /api/bets` - Crear Apuesta
- **Input**: `{ sessionId, gameId, drawId, drawName, number, amount, source }`
- **Proceso**:
  1. Valida sesión activa (vía AppSync).
  2. Valida número (4 dígitos).
  3. Valida monto (entre 500 y 2000).
  4. Llama a AppSync mutation `createBet`.
  5. Simula pago exitoso.
- **Output**: `{ success: true, betId, paidAt, amount }`

#### 7. `GET /api/bets?sessionId=xxx` - Historial de Apuestas
- **Proceso**:
  1. Valida sesión activa.
  2. Llama a AppSync query `listBets` con filtro `sessionId.eq`.
- **Output**: `{ bets: [...] }`

#### 8. `GET /api/games` - Catálogo de Juegos
- Llama a AppSync query `listGames`.
- **Output**: `{ games: [...] }`

---

## Flujo del Chatbot WhatsApp

### Menú Principal (después de sesión activa)
```
¡Hola! 👋 Tu sesión está activa. ¿Qué deseas hacer?

1️⃣ Ver juegos disponibles
2️⃣ Hacer una apuesta
3️⃣ Ver mis apuestas
4️⃣ Cerrar sesión
```

### Flujo de Apuesta
1. Usuario selecciona "Hacer una apuesta"
2. Bot muestra juegos: "Selecciona un juego: 1. Lotería Nacional, 2. Chance Express"
3. Usuario selecciona juego
4. Bot muestra sorteos del día (paginados de 10 en 10)
5. Usuario selecciona sorteo
6. Bot pide número: "Ingresa tu número de 4 cifras"
7. Usuario envía número
8. Bot pide monto: "¿Cuánto deseas apostar?"
9. Usuario envía monto
10. Bot confirma y "procesa pago" → siempre exitoso
11. Bot muestra confirmación: "✅ Apuesta registrada..."

### Estados de Conversación
- Se manejará un estado en DynamoDB (tabla `Conversation_prueba_whatsapp` vía AppSync) para trackear en qué paso del flujo está el usuario:
  - `idle` → Esperando selección de menú
  - `selecting_game` → Esperando selección de juego
  - `selecting_draw` → Esperando selección de sorteo
  - `entering_number` → Esperando número de 4 cifras
  - `entering_amount` → Esperando monto
  - `confirming` → Esperando confirmación de pago

---

## Formato de Moneda

- Todos los montos se formatean con separador de miles y símbolo de peso: `$1.000`, `$1.500`, `$2.000`.
- Se usa `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })`.
- Utilidad compartida en `app/lib/formatCurrency.ts` para frontend y backend.
- En la base de datos, los montos se almacenan como número y se formatean solo al enviar respuestas.

---

## Flujo UX de Apuestas (Frontend)

```
[Dashboard] → Seleccionar juego → [Ver sorteos del día]
                                         │
                                         ▼
                              Seleccionar sorteo (click/tap)
                                         │
                                         ▼
                              [Se habilita input: Número 4 cifras]
                                         │ (al completar 4 dígitos)
                                         ▼
                              [Se habilita input: Valor apuesta $500-$2.000]
                                         │ (al ingresar monto válido)
                                         ▼
                              [Se habilita botón: PAGAR]
                                         │
                                         ▼
                              [Confirmación de pago exitoso ✅]
```

---

## Datos Iniciales (Seed)

### Juegos
```json
[
  {
    "id": "loteria-nacional",
    "name": "Lotería Nacional",
    "description": "Sorteos cada hora. Escoge tu número de 4 cifras y gana.",
    "icon": "🎰"
  },
  {
    "id": "chance-express",
    "name": "Chance Express",
    "description": "Apuesta rápida. Resultados al instante cada hora.",
    "icon": "⚡"
  }
]
```

### Seed
- Se ejecuta con `bash scripts/seed-games.sh` (usa AWS CLI para insertar directamente en DynamoDB).
- Alternativa: usar la mutation `createGame` de AppSync.

---

## Configuración

### Variables de Entorno (`.env.local` / Amplify Console)
```bash
# AppSync
APPSYNC_ENDPOINT=https://xxx.appsync-api.us-east-1.amazonaws.com/graphql
APPSYNC_API_KEY=da2-xxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1

# WhatsApp
WHATSAPP_TOKEN=YOUR_TOKEN
WHATSAPP_VERIFY_TOKEN=YOUR_VERIFY_TOKEN
WHATSAPP_PHONE_NUMBER_ID=YOUR_PHONE_ID
```

### Tablas DynamoDB
Todas con PK `id` (String), capacity On-demand:
1. `Session_prueba_whatsapp`
2. `Game_prueba_whatsapp`
3. `Bet_prueba_whatsapp`
4. `Conversation_prueba_whatsapp`

### AppSync
- API con auth mode: API Key
- 4 Data Sources (uno por tabla DynamoDB)
- 15 Resolvers (8 queries + 7 mutations) en JavaScript runtime

---

## Dependencias

### Paquetes npm
- `aws-amplify` — SDK de Amplify (cliente GraphQL para AppSync)
- `next` — Framework
- `react` / `react-dom` — UI

### No se necesita (removido del plan original)
- ~~`@aws-sdk/client-dynamodb`~~ — No se accede directo a DynamoDB
- ~~`@aws-sdk/lib-dynamodb`~~ — No se accede directo a DynamoDB
- ~~`uuid`~~ — Se usa `crypto.randomUUID()` nativo de Node.js
