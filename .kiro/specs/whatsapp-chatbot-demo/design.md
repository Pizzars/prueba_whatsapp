# Diseño Técnico - Demo WhatsApp Chatbot de Apuestas

## Arquitectura General

```
┌───────────────────┐
│   Plataforma Web  │──────┐
│   (Next.js Pages) │      │
└───────────────────┘      │
                           ▼
                    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
                    │  API Routes  │────▶│   AppSync    │────▶│   DynamoDB   │
                    │  (Servicios) │     │  (GraphQL)   │     │  (4 tablas)  │
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

### Principio clave
Los **servicios (API Routes)** son la capa de negocio. Tanto la plataforma web como WhatsApp son clientes que consumen esos mismos servicios. WhatsApp solo agrega una capa de adaptación conversacional.

---

## Estructura del Proyecto

```
app/
├── layout.tsx                    # Layout principal
├── page.tsx                      # Dashboard (juegos, sorteos, apuestas)
├── globals.css                   # Estilos globales
├── login/
│   ├── page.tsx                  # Pantalla de login (documento + ubicación)
│   └── success/
│       └── page.tsx              # Pantalla post-login (para flujo WhatsApp)
├── api/
│   ├── auth/
│   │   └── login/
│   │       └── route.ts         # POST: login (valida documento, crea sesión)
│   ├── sessions/
│   │   └── validate/
│   │       └── route.ts         # GET: validar sesión activa
│   ├── games/
│   │   └── route.ts             # GET: listar juegos
│   ├── draws/
│   │   └── route.ts             # GET: listar sorteos paginados
│   ├── bets/
│   │   └── route.ts             # POST: crear apuesta | GET: historial
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
    │   ├── queries.ts            # Queries GraphQL
    │   └── mutations.ts          # Mutations GraphQL
    ├── users.ts                  # Usuarios hardcoded
    ├── sessions.ts               # Lógica de sesiones (crear, validar)
    ├── draws.ts                  # Generador de sorteos ficticios
    ├── formatCurrency.ts         # Utilidad para formato de moneda
    └── whatsapp/
        ├── sendMessage.ts        # Enviar mensajes vía WhatsApp API
        └── messageHandler.ts     # Adaptador: mensaje → servicio → respuesta
```

---

## Usuarios Hardcoded (`app/lib/users.ts`)

```typescript
export const USERS = [
  { documento: "1023456789", nombre: "Carlos Martínez" },
  { documento: "1098765432", nombre: "María López" },
  { documento: "1045678901", nombre: "Andrés García" },
  { documento: "1067890123", nombre: "Laura Rodríguez" },
];

export function findUserByDocumento(documento: string) {
  return USERS.find(u => u.documento === documento) || null;
}
```

---

## Servicios (API Routes)

### 1. `POST /api/auth/login` — Login
- **Input**: `{ documento, latitude, longitude, sessionId? }`
- **Proceso**:
  1. Valida documento contra lista hardcoded.
  2. Si no existe → error 401.
  3. Genera token (`crypto.randomUUID()`), calcula expiración (24h).
  4. Crea sesión en AppSync (`createSession`) con datos del usuario.
  5. Si viene `sessionId` (flujo WhatsApp), lo asocia a la sesión.
- **Output**: `{ success: true, token, sessionId, user: { nombre, documento }, expiresAt }`
- **Validación de sesión**: NO (este servicio crea la sesión).

### 2. `GET /api/sessions/validate?token=xxx` — Validar Sesión
- **Input**: Header `Authorization: Bearer <token>` o query param `token`
- **Proceso**:
  1. Busca sesión en AppSync (`listSessions` filtrado por token).
  2. Verifica `active: true` y `expiresAt > now`.
- **Output**: `{ valid: true, session }` o `{ valid: false, reason }`
- **Validación de sesión**: NO (este servicio valida sesiones).

### 3. `GET /api/games` — Listar Juegos
- **Proceso**: Consulta AppSync `listGames`.
- **Output**: `{ games: [...] }`
- **Validación de sesión**: SÍ.

### 4. `GET /api/draws?page=1&gameId=xxx` — Listar Sorteos
- **Proceso**:
  1. Genera sorteos del día (8:00 a 22:00).
  2. Filtra por gameId si viene.
  3. Pagina en bloques de 10.
- **Output**: `{ draws: [...], page, totalPages, hasMore }`
- **Validación de sesión**: SÍ.

### 5. `POST /api/bets` — Crear Apuesta
- **Input**: `{ gameId, drawId, drawName, number, amount, source }`
- **Proceso**:
  1. Valida número (4 dígitos).
  2. Valida monto (500-2000).
  3. Crea apuesta en AppSync (`createBet`).
  4. Simula pago exitoso.
- **Output**: `{ success: true, betId, paidAt, amount }`
- **Validación de sesión**: SÍ (obtiene sessionId del token).

### 6. `GET /api/bets` — Historial de Apuestas
- **Proceso**: Consulta AppSync `listBets` filtrado por sessionId (obtenido del token).
- **Output**: `{ bets: [...] }`
- **Validación de sesión**: SÍ.

### Patrón de validación de sesión

```typescript
// Middleware reutilizable en cada API Route
async function getValidSession(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  
  const session = await findSessionByToken(token);
  if (!session || !session.active || new Date(session.expiresAt) < new Date()) {
    return null;
  }
  return session;
}
```

---

## WhatsApp: Capa de Adaptación

### Principio
El webhook de WhatsApp NO contiene lógica de negocio. Solo:
1. Recibe un mensaje
2. Interpreta la intención del usuario (según el estado de la conversación)
3. Llama al servicio correspondiente (las mismas API Routes)
4. Formatea la respuesta como mensaje de WhatsApp

### Flujo interno del webhook

```
Mensaje WhatsApp
       │
       ▼
[messageHandler] → Lee estado de conversación (AppSync)
       │
       ▼
[Interpreta intención según estado]
       │
       ▼
[Llama al servicio correspondiente] ← REUTILIZA los mismos servicios
       │
       ▼
[Formatea respuesta para WhatsApp]
       │
       ▼
[sendMessage] → WhatsApp API
```

### Cómo WhatsApp reutiliza servicios

```typescript
// El messageHandler llama internamente a las mismas funciones
// que usan las API Routes, NO hace fetch a sí mismo.

import { getGames } from "@/app/lib/services/games";
import { createBet } from "@/app/lib/services/bets";
import { getDraws } from "@/app/lib/services/draws";
```

O alternativamente hace fetch interno a las propias API Routes:

```typescript
const response = await fetch(`${APP_URL}/api/games`, {
  headers: { Authorization: `Bearer ${session.token}` }
});
```

### Flujo de sesión WhatsApp
1. Usuario escribe al bot → bot no tiene sesión asociada.
2. Bot genera sessionId, crea URL: `${APP_URL}/login?session=${sessionId}`.
3. Envía URL al usuario.
4. Usuario abre URL → login web → servicio login crea sesión con ese sessionId.
5. Usuario vuelve a WhatsApp.
6. Bot recibe mensaje → busca conversación por phoneNumber → busca sesión por sessionId → sesión activa.
7. A partir de aquí, bot consume servicios con el token de esa sesión.

---

## Capa de Datos: AppSync GraphQL

### Cliente (`app/lib/amplify-server.ts`)
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

### Schema (ya desplegado en AppSync)
- Tipos: `Session_prueba_whatsapp`, `Game_prueba_whatsapp`, `Bet_prueba_whatsapp`, `Conversation_prueba_whatsapp`
- Queries: `getSession`, `listSessions`, `getGame`, `listGames`, `getBet`, `listBets`, `getConversation`, `listConversations`
- Mutations: `createSession`, `updateSession`, `deleteSession`, `createGame`, `createBet`, `createConversation`, `updateConversation`

---

## Formato de Moneda

- Todos los montos: `$1.000`, `$1.500`, `$2.000` (COP sin decimales).
- `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })`.
- Utilidad en `app/lib/formatCurrency.ts`.

---

## Flujo UX de Apuestas (Frontend)

```
[Login] → Documento + Ubicación → [Dashboard]
                                       │
                                       ▼
                            Seleccionar juego (GameCard)
                                       │
                                       ▼
                            Ver sorteos del día (DrawList)
                                       │
                                       ▼
                            Seleccionar sorteo
                                       │
                                       ▼
                            Ingresar número 4 cifras
                                       │
                                       ▼
                            Ingresar monto ($500-$2.000)
                                       │
                                       ▼
                            Botón PAGAR → Confirmación ✅
                                       │
                                       ▼
                            Ver historial (BetHistory)
```

---

## Datos Iniciales

### Juegos (seed)
```json
[
  { "id": "loteria-nacional", "name": "Lotería Nacional", "description": "Sorteos cada hora. Escoge tu número de 4 cifras y gana.", "icon": "🎰" },
  { "id": "chance-express", "name": "Chance Express", "description": "Apuesta rápida. Resultados al instante cada hora.", "icon": "⚡" }
]
```

### Usuarios (hardcoded en código)
```
1023456789 — Carlos Martínez
1098765432 — María López
1045678901 — Andrés García
1067890123 — Laura Rodríguez
```
