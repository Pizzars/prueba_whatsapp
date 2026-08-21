# Diseño Técnico - Demo WhatsApp Chatbot de Apuestas

## Arquitectura General

```
┌─────────────────────────────┐     ┌──────────────┐
│  Next.js (App Router)       │────▶│   DynamoDB   │
│  - Pages (React SSR/CSR)    │     │              │
│  - API Route Handlers       │     └──────────────┘
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
│   │   ├── route.ts             # POST: crear sesión | GET: validar sesión
│   │   └── [sessionId]/
│   │       └── route.ts         # GET: obtener sesión específica
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
    ├── dynamodb.ts               # Cliente DynamoDB (AWS SDK v3)
    ├── sessions.ts               # Lógica de sesiones (crear, validar)
    ├── draws.ts                  # Generador de sorteos ficticios
    ├── whatsapp/
    │   ├── sendMessage.ts        # Enviar mensajes vía WhatsApp API
    │   └── messageHandler.ts     # Procesar mensajes entrantes y estado
    └── formatCurrency.ts         # Utilidad para formato de moneda
```

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
  1. Genera token de autenticación (crypto.randomUUID).
  2. Calcula expiración (createdAt + 24h).
  3. Guarda item en tabla `Sessions` de DynamoDB.
- **Output**: `{ success: true, token, expiresAt, sessionId }`

#### 2. `GET /api/sessions?sessionId=xxx` - Validar Sesión
- **Input**: Query param `sessionId` o `token`
- **Proceso**:
  1. Busca sesión en DynamoDB.
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
  1. Valida sesión activa.
  2. Genera sorteos del día actual.
  3. Pagina en bloques de 10.
- **Output**: `{ draws: [...], page, totalPages, hasMore }`

#### 6. `POST /api/bets` - Crear Apuesta
- **Input**: `{ sessionId, gameId, drawId, drawName, number, amount, source }`
- **Proceso**:
  1. Valida sesión activa.
  2. Valida número (4 dígitos).
  3. Valida monto (entre 500 y 2000).
  4. Guarda en tabla `Bets` de DynamoDB.
  5. Simula pago exitoso.
- **Output**: `{ success: true, betId, paidAt, amount }`

#### 7. `GET /api/bets?sessionId=xxx` - Historial de Apuestas
- **Proceso**:
  1. Valida sesión activa.
  2. Consulta apuestas por sessionId (usando partition key).
- **Output**: `{ bets: [...] }`

#### 8. `GET /api/games` - Catálogo de Juegos
- **Output**: `{ games: [...] }` (2 juegos predefinidos)

---

## Cliente DynamoDB (`app/lib/dynamodb.ts`)

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

export const docClient = DynamoDBDocumentClient.from(client);
```

- Se usa AWS SDK v3 (`@aws-sdk/client-dynamodb` y `@aws-sdk/lib-dynamodb`).
- En Amplify, las credenciales se obtienen automáticamente del IAM Role.
- En desarrollo local, se usan variables de entorno (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).

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
- Se manejará un estado en DynamoDB (tabla `Conversations`) para trackear en qué paso del flujo está el usuario:
  - `idle` → Esperando selección de menú
  - `selecting_game` → Esperando selección de juego
  - `selecting_draw` → Esperando selección de sorteo
  - `entering_number` → Esperando número de 4 cifras
  - `entering_amount` → Esperando monto
  - `confirming` → Esperando confirmación de pago

---

## Formato de Moneda

- Todos los montos se formatean con separador de miles y símbolo de peso: `$1.000`, `$1.500`, `$2.000`.
- Se usa `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })` o equivalente.
- Utilidad compartida en `app/lib/formatCurrency.ts` para frontend y backend.
- En la base de datos, los montos se almacenan como número y se formatean solo al enviar respuestas al usuario.

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

### Script de Seed para DynamoDB
- Script en `scripts/seed.ts` que usa AWS SDK para crear los items iniciales en la tabla `Games`.
- Se puede ejecutar con `npx tsx scripts/seed.ts`.

---

## Configuración AWS Amplify

### Tablas DynamoDB a crear
1. `Sessions` - PK: `sessionId`
2. `Games` - PK: `id`
3. `Bets` - PK: `sessionId`, SK: `createdAt`
4. `Conversations` - PK: `phoneNumber`

### Variables de Entorno (Amplify Console)
```bash
AWS_REGION=us-east-1
WHATSAPP_TOKEN=YOUR_TOKEN
WHATSAPP_VERIFY_TOKEN=YOUR_VERIFY_TOKEN
WHATSAPP_PHONE_NUMBER_ID=YOUR_PHONE_ID
```

### IAM Policy (para el rol de Amplify)
El rol de ejecución de Amplify necesita permisos de DynamoDB:
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:UpdateItem",
    "dynamodb:Query",
    "dynamodb:Scan"
  ],
  "Resource": [
    "arn:aws:dynamodb:*:*:table/Sessions",
    "arn:aws:dynamodb:*:*:table/Games",
    "arn:aws:dynamodb:*:*:table/Bets",
    "arn:aws:dynamodb:*:*:table/Conversations"
  ]
}
```

---

## Dependencias Adicionales

### Paquetes npm
- `@aws-sdk/client-dynamodb` - Cliente DynamoDB
- `@aws-sdk/lib-dynamodb` - Document Client (simplifica operaciones)
- `uuid` - Generación de IDs únicos (o usar `crypto.randomUUID()`)

### Desarrollo local
- Se puede usar DynamoDB Local (Docker) para desarrollo sin conexión a AWS.
- Alternativa: conectar directamente a tablas de desarrollo en la cuenta de AWS.
