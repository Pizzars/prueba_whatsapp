# Requisitos - Demo WhatsApp Chatbot de Apuestas

## Descripción General
Demo de un chatbot de WhatsApp que gestiona ventas/apuestas deportivas. Los usuarios inician sesión desde una plataforma web (login dinámico generado desde WhatsApp), y luego interactúan con el chatbot para realizar apuestas en sorteos ficticios. Todo se almacena en DynamoDB y se comunica vía API Routes de Next.js, desplegado en AWS Amplify.

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
- Al iniciar sesión, se invoca un endpoint API que guarda en DynamoDB:
  - Token de autenticación (generado)
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
- Los juegos vienen desde DynamoDB, tabla `Games`.
- Crear 2 juegos ficticios de apuestas (lotería/sorteos) como datos iniciales.
- Cada juego tiene: ID, nombre, descripción e ícono/imagen representativa.
- El frontend y las API Routes consultan la tabla `Games` de DynamoDB como fuente de datos.

### RF-05: Sorteos Ficticios
- Los sorteos se generan dinámicamente basados en la hora actual.
- Cada sorteo tiene: ID, nombre, fecha, hora de juego.
- Se juegan cada hora (sorteos del día actual).
- La generación de sorteos es determinística basada en la fecha/hora.

### RF-06: Realizar Apuestas (Flujo Secuencial)
- El flujo de apuesta es secuencial y progresivo:
  1. El usuario entra a un juego y ve los sorteos disponibles del día.
  2. Selecciona un sorteo → se habilita el input para ingresar un número de 4 cifras.
  3. Completa el número de 4 cifras → se habilita el input del valor a apostar.
  4. El valor de la apuesta es entre $500 y $2,000 (formato de moneda con separadores de miles).
  5. Opción de "Pagar" que siempre será exitosa (plataforma de pruebas).
- Las apuestas se guardan en DynamoDB asociadas al usuario y sesión.
- Los montos se muestran siempre con formato de dinero (e.g., $1.000, $2.000).

### RF-07: Historial de Apuestas en Plataforma Web
- Cuando el usuario ingresa desde la plataforma web, puede ver:
  - Listado de juegos disponibles.
  - Historial de apuestas realizadas (desde web y WhatsApp).

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
- Se usa la API de WhatsApp Business (Cloud API de Meta) para enviar mensajes.

---

## Requisitos No Funcionales

### RNF-01: Stack Tecnológico
- Frontend + Backend: Next.js (App Router) con React
- API: Next.js API Route Handlers (`app/api/`)
- Base de datos: Amazon DynamoDB (vía AWS SDK v3)
- Hosting/Deploy: AWS Amplify
- API externa: WhatsApp Business Cloud API (Meta)

### RNF-02: Seguridad
- Las sesiones deben tener expiración configurable.
- Cada interacción desde WhatsApp debe validar sesión activa.
- El webhook debe validar la firma de Meta para autenticidad.

### RNF-03: Configuración de WhatsApp API
- Se requiere configurar variables de entorno en el proyecto (`.env.local` / Amplify Environment Variables):
  - `WHATSAPP_TOKEN`: Token de acceso permanente de la API.
  - `WHATSAPP_VERIFY_TOKEN`: Token de verificación del webhook.
  - `WHATSAPP_PHONE_NUMBER_ID`: ID del número de teléfono de WhatsApp Business.

### RNF-04: Configuración AWS
- Se requiere configurar variables de entorno para acceso a DynamoDB:
  - `AWS_REGION`: Región de AWS (e.g., `us-east-1`).
  - `AWS_ACCESS_KEY_ID`: Access key (o usar IAM Role en Amplify).
  - `AWS_SECRET_ACCESS_KEY`: Secret key (o usar IAM Role en Amplify).
- En producción (Amplify), se usará el IAM Role asociado al servicio para acceso a DynamoDB sin necesidad de keys explícitas.

---

## Estructura de Datos (DynamoDB)

### Tabla: `Sessions`
- **Partition Key**: `sessionId` (String)
```
{
  sessionId: string,         // ID de la URL (parámetro session)
  token: string,             // Token de autenticación generado
  location: {
    latitude: number,
    longitude: number
  },
  createdAt: string,         // ISO 8601 timestamp
  expiresAt: string,         // ISO 8601 timestamp
  phoneNumber: string,       // Número de WhatsApp (opcional, se asocia después)
  active: boolean
}
```

### Tabla: `Games`
- **Partition Key**: `id` (String)
```
{
  id: string,
  name: string,
  description: string,
  icon: string
}
```

### Tabla: `Bets`
- **Partition Key**: `sessionId` (String)
- **Sort Key**: `createdAt` (String)
```
{
  id: string,
  sessionId: string,
  gameId: string,
  drawId: string,
  drawName: string,
  number: string,           // 4 dígitos
  amount: number,
  paidAt: string,           // ISO 8601 timestamp
  source: "web" | "whatsapp",
  createdAt: string         // ISO 8601 timestamp
}
```

### Tabla: `Conversations`
- **Partition Key**: `phoneNumber` (String)
```
{
  phoneNumber: string,
  sessionId: string,
  state: string,            // idle, selecting_game, selecting_draw, entering_number, entering_amount, confirming
  context: {
    selectedGame?: string,
    selectedDraw?: string,
    betNumber?: string,
    betAmount?: number,
    currentPage?: number
  },
  updatedAt: string         // ISO 8601 timestamp
}
```

---

## Flujo Principal

1. Usuario contacta al bot de WhatsApp.
2. Bot envía menú de opciones (incluye "Iniciar sesión").
3. Bot genera URL dinámica con sessionId único y la envía al usuario.
4. Usuario abre URL en navegador → se muestra pantalla de login.
5. Login solicita permisos de ubicación → usuario acepta.
6. Se llama a la API Route que crea la sesión en DynamoDB.
7. Se muestra pantalla de confirmación con opción de volver a WhatsApp.
8. Usuario regresa a WhatsApp → bot detecta sesión activa.
9. Bot muestra menú: Ver juegos, Hacer apuesta, Ver mis apuestas.
10. Usuario selecciona opción y el bot gestiona la interacción.
