# Requisitos - Demo WhatsApp Chatbot de Apuestas

## Descripción General
Demo de un chatbot de WhatsApp que gestiona ventas/apuestas deportivas. Los usuarios inician sesión desde una plataforma web (login dinámico generado desde WhatsApp), y luego interactúan con el chatbot para realizar apuestas en sorteos ficticios. Los datos se almacenan en DynamoDB y se acceden a través de AWS AppSync (GraphQL). La app se despliega en AWS Amplify.

---

## Requisitos Funcionales

### RF-01: Login con Ubicación
- La app web debe tener una pantalla de login que solicite la ubicación del usuario (latitud/longitud) vía Geolocation API del navegador.
- La URL del login será dinámica, generada desde WhatsApp con un parámetro de sesión (e.g., `/login?session=abc123`).
- El parámetro `session` en la URL vincula la sesión web con el chat de WhatsApp.

### RF-02: Gestión de Sesión (Dual: Frontend + API)
- La sesión se maneja tanto desde el frontend como desde las API Routes de Next.js.
- **Desde el frontend**: Al iniciar sesión se guarda el estado de sesión en el contexto de la app (React state/localStorage) para uso interno de la plataforma web.
- **Desde la API**: Se exponen endpoints que permiten crear y validar sesiones para uso desde WhatsApp y otras integraciones externas.
- Al iniciar sesión, se invoca un endpoint API que guarda en DynamoDB (vía AppSync):
  - Token de autenticación (generado con `crypto.randomUUID()`)
  - Ubicación (latitud y longitud)
  - Fecha y hora de inicio de sesión
  - Vencimiento de sesión (configurable, e.g., 24 horas)
  - ID de sesión de WhatsApp (parámetro `session` de la URL)
- La sesión queda asociada al chat de WhatsApp mediante el `sessionId`.
- Ambos contextos (web y WhatsApp) usan la misma sesión en DynamoDB como fuente de verdad.

### RF-03: Pantalla Post-Login para WhatsApp
- Después del login exitoso (cuando viene desde WhatsApp), mostrar una pantalla indicando:
  - "Sesión iniciada correctamente"
  - "Puedes regresar al chat de WhatsApp"
  - Botón/enlace para volver a WhatsApp (deep link: `https://wa.me/`)

### RF-04: Catálogo de Juegos
- Los juegos se consultan vía AppSync GraphQL (query `listGames`).
- Datos almacenados en DynamoDB tabla `Game_prueba_whatsapp`.
- Crear 2 juegos ficticios de apuestas como datos iniciales (seed).
- Cada juego tiene: ID, nombre, descripción e ícono.

### RF-05: Sorteos Ficticios
- Los sorteos se generan dinámicamente basados en la hora actual.
- Cada sorteo tiene: ID, nombre, fecha, hora de juego.
- Se juegan cada hora (sorteos del día actual).
- La generación de sorteos es determinística basada en la fecha/hora.
- No se almacenan en base de datos — se generan en tiempo real.

### RF-06: Realizar Apuestas (Flujo Secuencial)
- El flujo de apuesta es secuencial y progresivo:
  1. El usuario entra a un juego y ve los sorteos disponibles del día.
  2. Selecciona un sorteo → se habilita el input para ingresar un número de 4 cifras.
  3. Completa el número de 4 cifras → se habilita el input del valor a apostar.
  4. El valor de la apuesta es entre $500 y $2,000 (formato de moneda con separadores de miles).
  5. Opción de "Pagar" que siempre será exitosa (plataforma de pruebas).
- Las apuestas se guardan vía AppSync (mutation `createBet`) en DynamoDB.
- Los montos se muestran siempre con formato de dinero (e.g., $1.000, $2.000).

### RF-07: Historial de Apuestas en Plataforma Web
- Cuando el usuario ingresa desde la plataforma web, puede ver:
  - Listado de juegos disponibles.
  - Historial de apuestas realizadas (desde web y WhatsApp), consultado vía AppSync `listBets` con filtro por sessionId.

### RF-08: Webhook de WhatsApp (API Route)
- API Route de Next.js como webhook para recibir mensajes de WhatsApp API.
- Verificación de webhook (GET) para validación de Meta.
- Procesamiento de mensajes entrantes (POST).
- Verificación de sesión activa en cada solicitud de servicio.

### RF-09: Servicios para WhatsApp
- Endpoint para obtener listado paginado de sorteos (10 por página).
- Endpoint para registrar una apuesta desde WhatsApp.
- Menú de opciones interactivo en el chatbot después del login.
- Validación de sesión vigente en cada interacción.

### RF-10: Comunicación WhatsApp → API Routes
- WhatsApp se comunica directamente con las API Routes de Next.js vía webhooks.
- Las API Routes procesan los mensajes y responden con mensajes de WhatsApp.
- Las API Routes consultan/escriben datos a través de AppSync GraphQL.
- Se usa la API de WhatsApp Business (Cloud API de Meta) para enviar mensajes.

---

## Requisitos No Funcionales

### RNF-01: Stack Tecnológico
- Frontend + Backend: Next.js (App Router) con React
- API: Next.js API Route Handlers (`app/api/`)
- Capa de datos: AWS AppSync (GraphQL API)
- Base de datos: Amazon DynamoDB (accedida exclusivamente vía AppSync)
- Hosting/Deploy: AWS Amplify
- Cliente GraphQL: aws-amplify (SDK)
- API externa: WhatsApp Business Cloud API (Meta)

### RNF-02: Seguridad
- Las sesiones deben tener expiración configurable.
- Cada interacción desde WhatsApp debe validar sesión activa.
- El webhook debe validar la firma de Meta para autenticidad.
- AppSync se autentica con API Key (suficiente para demo/pruebas).

### RNF-03: Configuración de WhatsApp API
- Se requiere configurar variables de entorno en el proyecto (`.env.local` / Amplify Environment Variables):
  - `WHATSAPP_TOKEN`: Token de acceso permanente de la API.
  - `WHATSAPP_VERIFY_TOKEN`: Token de verificación del webhook.
  - `WHATSAPP_PHONE_NUMBER_ID`: ID del número de teléfono de WhatsApp Business.

### RNF-04: Configuración AWS AppSync
- Se requiere configurar variables de entorno:
  - `APPSYNC_ENDPOINT`: URL del endpoint GraphQL de AppSync.
  - `APPSYNC_API_KEY`: API Key de AppSync para autenticación.
  - `AWS_REGION`: Región de AWS (e.g., `us-east-1`).
- En producción (Amplify), estas variables se configuran en la consola de Amplify.
- En desarrollo local, se usan desde `.env.local`.

---

## Estructura de Datos (DynamoDB vía AppSync)

### Tabla: `Session_prueba_whatsapp`
- **Partition Key**: `id` (String)
```
{
  id: string,                // ID interno (auto-generado)
  sessionId: string,         // ID de la URL (parámetro session)
  token: string,             // Token de autenticación generado
  latitude: float,
  longitude: float,
  createdAt: string,         // ISO 8601 (AWSDateTime)
  expiresAt: string,         // ISO 8601 (AWSDateTime)
  phoneNumber: string,       // Número de WhatsApp (opcional)
  active: boolean
}
```

### Tabla: `Game_prueba_whatsapp`
- **Partition Key**: `id` (String)
```
{
  id: string,
  name: string,
  description: string,
  icon: string
}
```

### Tabla: `Bet_prueba_whatsapp`
- **Partition Key**: `id` (String)
```
{
  id: string,
  sessionId: string,
  gameId: string,
  drawId: string,
  drawName: string,
  number: string,           // 4 dígitos
  amount: float,
  paidAt: string,           // ISO 8601 (AWSDateTime)
  source: string,           // "web" | "whatsapp"
  createdAt: string         // ISO 8601 (AWSDateTime)
}
```

### Tabla: `Conversation_prueba_whatsapp`
- **Partition Key**: `id` (String)
```
{
  id: string,
  phoneNumber: string,
  sessionId: string,
  state: string,            // idle, selecting_game, selecting_draw, entering_number, entering_amount, confirming
  selectedGame: string,
  selectedDraw: string,
  betNumber: string,
  betAmount: float,
  currentPage: int,
  updatedAt: string         // ISO 8601 (AWSDateTime)
}
```

---

## Flujo Principal

1. Usuario contacta al bot de WhatsApp.
2. Bot envía menú de opciones (incluye "Iniciar sesión").
3. Bot genera URL dinámica con sessionId único y la envía al usuario.
4. Usuario abre URL en navegador → se muestra pantalla de login.
5. Login solicita permisos de ubicación → usuario acepta.
6. Se llama a la API Route `POST /api/sessions` → crea sesión en DynamoDB vía AppSync.
7. Se muestra pantalla de confirmación con opción de volver a WhatsApp.
8. Usuario regresa a WhatsApp → bot detecta sesión activa.
9. Bot muestra menú: Ver juegos, Hacer apuesta, Ver mis apuestas.
10. Usuario selecciona opción y el bot gestiona la interacción.
