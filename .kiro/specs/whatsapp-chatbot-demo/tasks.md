# Tareas de Implementación - Demo WhatsApp Chatbot de Apuestas

## Fase 0: Infraestructura ✅ (Completado)

### Tarea 0.1: AppSync + DynamoDB
- [x] Crear 4 tablas DynamoDB (`*_prueba_whatsapp`).
- [x] Crear API GraphQL en AppSync con schema.
- [x] Crear Data Sources y Resolvers.
- [x] Configurar `aws-amplify` y cliente GraphQL.
- [x] Crear queries/mutations en `app/lib/graphql/`.
- [x] Seed de juegos.
- [x] Documentación en `docs/`.

---

## Fase 1: Plataforma Web — Servicios y Login ✅ (Completado)

### Tarea 1.1: Usuarios hardcoded
- [x] Crear `app/lib/users.ts` con lista de 4 usuarios (documento + nombre).
- [x] Exportar función `findUserByDocumento()`.

### Tarea 1.2: Lógica de sesiones
- [x] Crear `app/lib/sessions.ts` con funciones:
  - `createNewSession(data)` → crea sesión en AppSync, retorna token.
  - `validateSession(token)` → busca sesión, verifica activa y no expirada.
  - `getSessionBySessionId(sessionId)` → busca por sessionId (para WhatsApp).
- [x] Estas funciones son la base que usan TODOS los servicios.

### Tarea 1.3: API Route — Login
- [x] Crear `app/api/auth/login/route.ts` (POST).
- [x] Recibir `{ documento, latitude, longitude, sessionId? }`.
- [x] Validar documento contra usuarios hardcoded.
- [x] Crear sesión vía `createNewSession()`.
- [x] Retornar token, datos de usuario, expiración.

### Tarea 1.4: API Route — Validar Sesión
- [x] Crear `app/api/sessions/validate/route.ts` (GET).
- [x] Leer token del header `Authorization: Bearer <token>`.
- [x] Validar con `validateSession(token)`.
- [x] Retornar estado de la sesión.

### Tarea 1.5: Pantalla de Login (Frontend)
- [x] Crear `app/login/page.tsx` (Client Component).
- [x] Input para documento (10 dígitos, validación visual).
- [x] Botón "Iniciar Sesión" → solicita ubicación → llama `POST /api/auth/login`.
- [x] Leer param `session` de URL (si viene de WhatsApp).
- [x] Si login exitoso: guardar token en localStorage.
- [x] Si tiene `session` param → redirigir a `/login/success`.
- [x] Si no tiene `session` param → redirigir a `/` (dashboard).

### Tarea 1.6: Pantalla Post-Login WhatsApp
- [x] Crear `app/login/success/page.tsx`.
- [x] Mostrar "Sesión iniciada correctamente".
- [x] Mostrar "Puedes volver a WhatsApp".
- [x] Deep link a WhatsApp (`https://wa.me/`).

---

## Fase 2: Plataforma Web — Juegos y Apuestas ✅ (Completado)

### Tarea 2.1: Utilidades compartidas
- [x] Crear `app/lib/draws.ts` — genera sorteos ficticios (8:00-22:00, ID determinístico).
- [x] Crear `app/lib/formatCurrency.ts` — formato COP sin decimales.

### Tarea 2.2: API Routes de Servicios
- [x] Crear `app/api/games/route.ts` (GET):
  - Validar sesión.
  - Consultar `listGames` en AppSync.
  - Retornar juegos.
- [x] Crear `app/api/draws/route.ts` (GET):
  - Validar sesión.
  - Generar sorteos del día.
  - Paginar (10 por página, params `page` y `gameId`).
- [x] Crear `app/api/bets/route.ts`:
  - POST: Validar sesión → validar número (4 dígitos) → validar monto (500-2000) → `createBet` en AppSync.
  - GET: Validar sesión → `listBets` filtrado por sessionId del token.

### Tarea 2.3: Dashboard (Frontend)
- [x] Actualizar `app/page.tsx`:
  - Si no hay token en localStorage → redirigir a `/login`.
  - Si hay token → validar sesión con `/api/sessions/validate`.
  - Mostrar nombre del usuario logueado.
  - Mostrar catálogo de juegos (fetch a `/api/games`).
  - Permitir seleccionar un juego.

### Tarea 2.4: Componentes de Apuesta
- [x] Crear `app/components/GameCard.tsx` — Tarjeta visual del juego (nombre, ícono, descripción).
- [x] Crear `app/components/DrawList.tsx` — Lista de sorteos del juego seleccionado.
- [x] Crear `app/components/BetForm.tsx` — Flujo secuencial:
  - Seleccionar sorteo → habilita input número.
  - Completar 4 cifras → habilita input monto.
  - Monto válido → habilita botón "Pagar".
  - Click "Pagar" → POST `/api/bets` → muestra confirmación.
- [x] Crear `app/components/BetHistory.tsx` — Lista de apuestas (monto formateado, source, fecha).

### Tarea 2.5: Integración completa del Dashboard
- [x] Conectar GameCard → al click muestra DrawList.
- [x] Conectar DrawList + BetForm → flujo de apuesta.
- [x] Agregar sección de historial con BetHistory.
- [x] Verificar flujo completo: login → seleccionar juego → apostar → ver historial.

---

## Fase 3: WhatsApp — Adaptador sobre servicios existentes ✅ (Completado)

### Tarea 3.1: Webhook de WhatsApp
- [x] Crear `app/api/whatsapp/webhook/route.ts`.
- [x] GET: Verificación (validar `hub.verify_token`, responder `hub.challenge`).
- [x] POST: Parsear mensaje, extraer phoneNumber y texto, delegar a messageHandler.

### Tarea 3.2: Envío de Mensajes
- [x] Crear `app/lib/whatsapp/sendMessage.ts`.
- [x] Función `sendText(phoneNumber, message)` → WhatsApp Cloud API.
- [x] Función `sendInteractive(phoneNumber, body, buttons)` → mensajes con opciones.

### Tarea 3.3: Manejador de Mensajes (Adaptador)
- [x] Crear `app/lib/whatsapp/messageHandler.ts`.
- [x] Gestionar estado de conversación en AppSync (`Conversation_prueba_whatsapp`).
- [x] Estados: `idle`, `awaiting_login`, `selecting_game`, `selecting_draw`, `entering_number`, `entering_amount`.
- [x] Implementar flujos:
  - **Sin sesión**: Enviar URL de login (`${APP_URL}/login?session=${sessionId}`).
  - **Con sesión** → Menú principal:
    - "1" → Listar juegos (llama servicio de juegos).
    - "2" → Flujo de apuesta (llama servicios de sorteos + apuestas).
    - "3" → Ver apuestas (llama servicio de historial).
- [x] **Importante**: El messageHandler consume los mismos servicios/funciones que las API Routes, NO reimplementa lógica.

### Tarea 3.4: Asociación Sesión ↔ WhatsApp
- [x] Cuando usuario hace login desde URL con `sessionId`:
  - La sesión se crea con ese sessionId.
- [x] Cuando bot recibe mensaje post-login:
  - Busca conversación por phoneNumber → obtiene sessionId → busca sesión → valida activa.
  - Asocia phoneNumber a la sesión (`updateSession`).
- [x] A partir de ahí, el bot usa el token de esa sesión para consumir servicios.

---

## Fase 4: Deploy y Verificación

### Tarea 4.1: Variables de entorno en Amplify
- [ ] Configurar en Amplify Console:
  - `APPSYNC_ENDPOINT`, `APPSYNC_API_KEY`, `AWS_REGION`
  - `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
  - `NEXT_PUBLIC_APP_URL`

### Tarea 4.2: Actualizar schema en AppSync
- [ ] Ejecutar `bash scripts/update-schema.sh` o pegar schema manualmente.
- [ ] Verificar que los campos `documento`, `nombre` y filtro `token` estén activos.

### Tarea 4.3: Verificación
- [x] `npm run build` sin errores.
- [ ] Probar flujo web completo: login → juegos → apuesta → historial.
- [ ] Probar webhook WhatsApp con herramienta de Meta.
- [ ] Verificar que WhatsApp usa los mismos servicios que la web.

---

## Orden de Ejecución
1. ~~Fase 0~~ → Infraestructura ✅
2. ~~Fase 1~~ → Login + Sesiones ✅
3. ~~Fase 2~~ → Juegos + Apuestas ✅
4. ~~Fase 3~~ → WhatsApp ✅
5. **Fase 4** → Deploy y verificación (pendiente: configurar variables + probar en producción)
