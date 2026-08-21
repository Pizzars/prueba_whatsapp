# Requisitos - Demo WhatsApp Chatbot de Apuestas

## Descripción General
Demo de una plataforma de apuestas con dos interfaces: una aplicación web y un chatbot de WhatsApp. Ambas interfaces consumen los mismos servicios de backend. La plataforma web es el sistema principal; WhatsApp actúa como un segundo cliente que reutiliza los servicios existentes a través de una capa de adaptación conversacional.

Los datos se almacenan en DynamoDB y se acceden a través de AWS AppSync (GraphQL). La app se despliega en AWS Amplify.

---

## Requisitos Funcionales

### RF-01: Login con Documento y Ubicación
- La app web debe tener una pantalla de login donde el usuario ingresa su número de documento (10 dígitos).
- Se solicita la ubicación del usuario (latitud/longitud) vía Geolocation API del navegador.
- Los usuarios son hardcoded (4 usuarios predefinidos en el código).
- No hay contraseña — solo el documento como credencial.
- Al hacer login:
  1. Se valida que el documento exista en la lista de usuarios.
  2. Se solicita ubicación.
  3. Se crea una sesión invocando el servicio de sesiones.
- La URL del login puede ser directa (`/login`) o dinámica con sesión de WhatsApp (`/login?session=abc123`).

### RF-02: Gestión de Sesión
- Al iniciar sesión exitosamente, se crea una sesión en DynamoDB (vía AppSync) con:
  - Token de autenticación (generado con `crypto.randomUUID()`)
  - Documento del usuario
  - Nombre del usuario
  - Ubicación (latitud y longitud)
  - Fecha y hora de inicio
  - Vencimiento (24 horas)
  - SessionId (si viene de WhatsApp)
  - Estado activo
- El frontend guarda el token en localStorage para requests posteriores.
- Cada servicio de la plataforma valida la sesión antes de operar (excepto el login).

### RF-03: Catálogo de Juegos
- Los juegos se consultan vía un servicio (API Route → AppSync `listGames`).
- 2 juegos ficticios precargados como seed.
- Cada juego tiene: ID, nombre, descripción e ícono.

### RF-04: Sorteos Ficticios
- Los sorteos se generan dinámicamente basados en la hora actual.
- Cada sorteo tiene: ID, nombre, fecha, hora de juego.
- Se juegan cada hora (sorteos del día actual, de 8:00 a 22:00).
- No se almacenan en base de datos — se generan en tiempo real.
- El servicio de sorteos requiere sesión válida.

### RF-05: Realizar Apuestas (Flujo Secuencial)
- El flujo de apuesta es secuencial y progresivo:
  1. El usuario selecciona un juego.
  2. Ve los sorteos disponibles del día.
  3. Selecciona un sorteo → se habilita input para número de 4 cifras.
  4. Completa el número → se habilita input del valor a apostar ($500 - $2.000).
  5. Click en "Pagar" → siempre exitoso (plataforma de pruebas).
- El servicio de apuestas valida sesión, número y monto antes de registrar.
- Las apuestas se guardan vía AppSync (`createBet`).

### RF-06: Historial de Apuestas
- El usuario puede ver todas sus apuestas realizadas (web y WhatsApp).
- Se consultan vía servicio (API Route → AppSync `listBets` filtrado por sessionId).
- Requiere sesión válida.

### RF-07: Servicios Reutilizables (API Routes)
- Todos los servicios de la plataforma son API Routes de Next.js independientes.
- Cada servicio (excepto login) valida la sesión del usuario.
- Los servicios son:
  - `POST /api/auth/login` — Login (crea sesión)
  - `GET /api/sessions/validate` — Validar sesión
  - `GET /api/games` — Listar juegos
  - `GET /api/draws` — Listar sorteos (paginado)
  - `POST /api/bets` — Crear apuesta
  - `GET /api/bets` — Historial de apuestas
- Estos mismos servicios se reutilizan desde WhatsApp.

### RF-08: Pantalla Post-Login para WhatsApp
- Cuando el login viene desde WhatsApp (`/login?session=abc123`), después del login exitoso:
  - Mostrar "Sesión iniciada correctamente"
  - Mostrar "Puedes regresar al chat de WhatsApp"
  - Botón/deep link para volver a WhatsApp (`https://wa.me/`)

### RF-09: WhatsApp como Segundo Cliente
- WhatsApp se integra vía webhook (API Route).
- El flujo de sesión:
  1. Usuario contacta al bot.
  2. Bot genera URL de login con sessionId único.
  3. Usuario abre URL → hace login en la web → sesión se asocia al sessionId.
  4. Usuario vuelve a WhatsApp → bot detecta sesión activa.
- Una vez con sesión activa, el bot ofrece menú y consume los **mismos servicios** de la plataforma:
  - Ver juegos → llama al servicio de juegos
  - Hacer apuesta → llama al servicio de apuestas
  - Ver mis apuestas → llama al servicio de historial
- WhatsApp no tiene lógica de negocio propia — es una capa de adaptación que traduce mensajes a llamadas de servicios existentes.

### RF-10: Comunicación WhatsApp
- WhatsApp se comunica con el webhook (API Route de Next.js).
- El webhook interpreta el mensaje, determina la intención y llama al servicio correspondiente.
- Se usa la API de WhatsApp Business (Cloud API de Meta) para enviar respuestas.

---

## Requisitos No Funcionales

### RNF-01: Stack Tecnológico
- Frontend + Backend: Next.js (App Router) con React
- API: Next.js API Route Handlers (`app/api/`)
- Capa de datos: AWS AppSync (GraphQL)
- Base de datos: Amazon DynamoDB (accedida vía AppSync)
- Hosting/Deploy: AWS Amplify
- Cliente GraphQL: aws-amplify (SDK)
- API externa: WhatsApp Business Cloud API (Meta)

### RNF-02: Seguridad
- Las sesiones expiran en 24 horas.
- Cada servicio valida sesión activa antes de operar.
- El webhook valida la firma de Meta para autenticidad.
- AppSync se autentica con API Key (suficiente para demo).

### RNF-03: Variables de Entorno
```
# AppSync
APPSYNC_ENDPOINT=https://xxx.appsync-api.us-east-1.amazonaws.com/graphql
APPSYNC_API_KEY=da2-xxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1

# WhatsApp
WHATSAPP_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# App
NEXT_PUBLIC_APP_URL=https://tu-app.amplifyapp.com
```

---

## Estructura de Datos (DynamoDB vía AppSync)

### Tabla: `Session_prueba_whatsapp` (PK: `id`)
```
{
  id: string,
  sessionId: string,         // ID para vincular con WhatsApp (puede ser el mismo que id)
  token: string,             // Token de autenticación
  documento: string,         // Documento del usuario
  nombre: string,            // Nombre del usuario
  latitude: float,
  longitude: float,
  createdAt: AWSDateTime,
  expiresAt: AWSDateTime,
  phoneNumber: string,       // Número de WhatsApp (se asocia después)
  active: boolean
}
```

### Tabla: `Game_prueba_whatsapp` (PK: `id`)
```
{
  id: string,
  name: string,
  description: string,
  icon: string
}
```

### Tabla: `Bet_prueba_whatsapp` (PK: `id`)
```
{
  id: string,
  sessionId: string,
  gameId: string,
  drawId: string,
  drawName: string,
  number: string,           // 4 dígitos
  amount: float,
  paidAt: AWSDateTime,
  source: string,           // "web" | "whatsapp"
  createdAt: AWSDateTime
}
```

### Tabla: `Conversation_prueba_whatsapp` (PK: `id`)
```
{
  id: string,
  phoneNumber: string,
  sessionId: string,
  state: string,
  selectedGame: string,
  selectedDraw: string,
  betNumber: string,
  betAmount: float,
  currentPage: int,
  updatedAt: AWSDateTime
}
```

---

## Flujo Principal (Web)

1. Usuario abre la plataforma → ve pantalla de login.
2. Ingresa su documento (10 dígitos) → se valida contra lista hardcoded.
3. Se solicita ubicación → se crea sesión → se guarda token.
4. Usuario ve el dashboard con juegos disponibles.
5. Selecciona un juego → ve sorteos del día.
6. Selecciona sorteo → ingresa número → ingresa monto → paga.
7. Ve confirmación y puede consultar su historial.

## Flujo Principal (WhatsApp)

1. Usuario contacta al bot.
2. Bot envía URL de login con sessionId.
3. Usuario abre URL → hace login (mismo flujo web).
4. El servicio de login asocia la sesión al sessionId de WhatsApp.
5. Usuario vuelve a WhatsApp → bot detecta sesión activa.
6. Bot ofrece menú → usuario interactúa → bot llama servicios existentes.
7. Respuestas se formatean como mensajes de WhatsApp.
