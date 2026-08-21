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

## Fase 1: Plataforma Web — Servicios y Login

### Tarea 1.1: Usuarios hardcoded
- [ ] Crear `app/lib/users.ts` con lista de 4 usuarios (documento + nombre).
- [ ] Exportar función `findUserByDocumento()`.

### Tarea 1.2: Lógica de sesiones
- [ ] Crear `app/lib/sessions.ts` con funciones:
  - `createNewSession(data)` → crea sesión en AppSync, retorna token.
  - `validateSession(token)` → busca sesión, verifica activa y no expirada.
  - `getSessionBySessionId(sessionId)` → busca por sessionId (para WhatsApp).
- [ ] Estas funciones son la base que usan TODOS los servicios.

### Tarea 1.3: API Route — Login
- [ ] Crear `app/api/auth/login/route.ts` (POST).
- [ ] Recibir `{ documento, latitude, longitude, sessionId? }`.
- [ ] Validar documento contra usuarios hardcoded.
- [ ] Crear sesión vía `createNewSession()`.
- [ ] Retornar token, datos de usuario, expiración.

### Tarea 1.4: API Route — Validar Sesión
- [ ] Crear `app/api/sessions/validate/route.ts` (GET).
- [ ] Leer token del header `Authorization: Bearer <token>`.
- [ ] Validar con `validateSession(token)`.
- [ ] Retornar estado de la sesión.

### Tarea 1.5: Pantalla de Login (Frontend)
- [ ] Crear `app/login/page.tsx` (Client Component).
- [ ] Input para documento (10 dígitos, validación visual).
- [ ] Botón "Iniciar Sesión" → solicita ubicación → llama `POST /api/auth/login`.
- [ ] Leer param `session` de URL (si viene de WhatsApp).
- [ ] Si login exitoso: guardar token en localStorage.
- [ ] Si tiene `session` param → redirigir a `/login/success`.
- [ ] Si no tiene `session` param → redirigir a `/` (dashboard).

### Tarea 1.6: Pantalla Post-Login WhatsApp
- [ ] Crear `app/login/success/page.tsx`.
- [ ] Mostrar "Sesión iniciada correctamente".
- [ ] Mostrar "Puedes volver a WhatsApp".
- [ ] Deep link a WhatsApp (`https://wa.me/`).

---

## Fase 2: Plataforma Web — Juegos y Apuestas

### Tarea 2.1: Utilidades compartidas
- [ ] Crear `app/lib/draws.ts` — genera sorteos ficticios (8:00-22:00, ID determinístico).
- [ ] Crear `app/lib/formatCurrency.ts` — formato COP sin decimales.

### Tarea 2.2: API Routes de Servicios
- [ ] Crear `app/api/games/route.ts` (GET):
  - Validar sesión.
  - Consultar `listGames` en AppSync.
  - Retornar juegos.
- [ ] Crear `app/api/draws/route.ts` (GET):
  - Validar sesión.
  - Generar sorteos del día.
  - Paginar (10 por página, params `page` y `gameId`).
- [ ] Crear `app/api/bets/route.ts`:
  - POST: Validar sesión → validar número (4 dígitos) → validar monto (500-2000) → `createBet` en AppSync.
  - GET: Validar sesión → `listBets` filtrado por sessionId del token.

### Tarea 2.3: Dashboard (Frontend)
- [ ] Actualizar `app/page.tsx`:
  - Si no hay token en localStorage → redirigir a `/login`.
  - Si hay token → validar sesión con `/api/sessions/validate`.
  - Mostrar nombre del usuario logueado.
  - Mostrar catálogo de juegos (fetch a `/api/games`).
  - Permitir seleccionar un juego.

### Tarea 2.4: Componentes de Apuesta
- [ ] Crear `app/components/GameCard.tsx` — Tarjeta visual del juego (nombre, ícono, descripción).
- [ ] Crear `app/components/DrawList.tsx` — Lista de sorteos del juego seleccionado.
- [ ] Crear `app/components/BetForm.tsx` — Flujo secuencial:
  - Seleccionar sorteo → habilita input número.
  - Completar 4 cifras → habilita input monto.
  - Monto válido → habilita botón "Pagar".
  - Click "Pagar" → POST `/api/bets` → muestra confirmación.
- [ ] Crear `app/components/BetHistory.tsx` — Lista de apuestas (monto formateado, source, fecha).

### Tarea 2.5: Integración completa del Dashboard
- [ ] Conectar GameCard → al click muestra DrawList.
- [ ] Conectar DrawList + BetForm → flujo de apuesta.
- [ ] Agregar sección de historial con BetHistory.
- [ ] Verificar flujo completo: login → seleccionar juego → apostar → ver historial.

---

## Fase 3: WhatsApp — Adaptador sobre servicios existentes

### Tarea 3.1: Webhook de WhatsApp
- [ ] Crear `app/api/whatsapp/webhook/route.ts`.
- [ ] GET: Verificación (validar `hub.verify_token`, responder `hub.challenge`).
- [ ] POST: Parsear mensaje, extraer phoneNumber y texto, delegar a messageHandler.

### Tarea 3.2: Envío de Mensajes
- [ ] Crear `app/lib/whatsapp/sendMessage.ts`.
- [ ] Función `sendText(phoneNumber, message)` → WhatsApp Cloud API.
- [ ] Función `sendInteractive(phoneNumber, body, buttons)` → mensajes con opciones.

### Tarea 3.3: Manejador de Mensajes (Adaptador)
- [ ] Crear `app/lib/whatsapp/messageHandler.ts`.
- [ ] Gestionar estado de conversación en AppSync (`Conversation_prueba_whatsapp`).
- [ ] Estados: `idle`, `awaiting_login`, `selecting_game`, `selecting_draw`, `entering_number`, `entering_amount`.
- [ ] Implementar flujos:
  - **Sin sesión**: Enviar URL de login (`${APP_URL}/login?session=${sessionId}`).
  - **Con sesión** → Menú principal:
    - "1" → Listar juegos (llama servicio de juegos).
    - "2" → Flujo de apuesta (llama servicios de sorteos + apuestas).
    - "3" → Ver apuestas (llama servicio de historial).
- [ ] **Importante**: El messageHandler consume los mismos servicios/funciones que las API Routes, NO reimplementa lógica.

### Tarea 3.4: Asociación Sesión ↔ WhatsApp
- [ ] Cuando usuario hace login desde URL con `sessionId`:
  - La sesión se crea con ese sessionId.
- [ ] Cuando bot recibe mensaje post-login:
  - Busca conversación por phoneNumber → obtiene sessionId → busca sesión → valida activa.
  - Asocia phoneNumber a la sesión (`updateSession`).
- [ ] A partir de ahí, el bot usa el token de esa sesión para consumir servicios.

---

## Fase 4: Deploy y Verificación

### Tarea 4.1: Variables de entorno en Amplify
- [ ] Configurar en Amplify Console:
  - `APPSYNC_ENDPOINT`, `APPSYNC_API_KEY`, `AWS_REGION`
  - `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
  - `NEXT_PUBLIC_APP_URL`

### Tarea 4.2: Verificación
- [ ] `npm run build` sin errores.
- [ ] Probar flujo web completo: login → juegos → apuesta → historial.
- [ ] Probar webhook WhatsApp con herramienta de Meta.
- [ ] Verificar que WhatsApp usa los mismos servicios que la web.

---

## Orden de Ejecución
1. ~~Fase 0~~ → Infraestructura ✅
2. **Fase 1** → Login + Sesiones (backend + frontend)
3. **Fase 2** → Juegos + Apuestas (servicios + UI completa)
4. **Fase 3** → WhatsApp (adaptador sobre servicios existentes)
5. **Fase 4** → Deploy y verificación
