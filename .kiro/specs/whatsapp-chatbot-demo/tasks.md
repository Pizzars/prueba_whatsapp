# Tareas de Implementación - Demo WhatsApp Chatbot de Apuestas

## Fase 1: Configuración Base ✅ (Completado)

### Tarea 1.1: Configurar AppSync y Amplify
- [x] Instalar `aws-amplify`.
- [x] Crear `aws-exports.js` con configuración de AppSync (endpoint, apiKey, region).
- [x] Crear `app/lib/amplify-server.ts` con configuración de Amplify y cliente GraphQL.
- [x] Crear `.env.local` con variables de entorno.
- [x] Crear `.env.example` para documentación.

### Tarea 1.2: Schema GraphQL y Resolvers
- [x] Crear `schema.graphql` con los 4 tipos, inputs, queries, mutations y subscriptions.
- [x] Crear resolvers JS en `scripts/resolvers/` (getItem, listItems, createItem, updateItem, deleteItem).
- [x] Desplegar resolvers en AppSync vía CLI (`scripts/deploy-resolvers.sh`).

### Tarea 1.3: Infraestructura DynamoDB
- [x] Crear 4 tablas DynamoDB (`*_prueba_whatsapp`) con PK `id`.
- [x] Crear 4 Data Sources en AppSync conectados a las tablas.
- [x] Crear script de seed (`scripts/seed-games.sh`) para juegos iniciales.

### Tarea 1.4: Queries y Mutations en el proyecto
- [x] Crear `app/lib/graphql/queries.ts` con todos los queries tipados.
- [x] Crear `app/lib/graphql/mutations.ts` con todas las mutations tipadas.

### Tarea 1.5: Documentación
- [x] Crear `docs/setup-appsync-cli.md` con guía completa de setup.

---

## Fase 2: Sistema de Sesiones

### Tarea 2.1: API Route - Crear Sesión
- [ ] Crear `app/api/sessions/route.ts` con handler POST.
- [ ] Recibir `{ sessionId, location: { latitude, longitude } }`.
- [ ] Generar token (`crypto.randomUUID()`), calcular expiración (24h).
- [ ] Llamar a AppSync mutation `createSession` para guardar en DynamoDB.
- [ ] Retornar `{ success: true, token, expiresAt, sessionId }`.

### Tarea 2.2: API Route - Validar Sesión
- [ ] En el mismo `app/api/sessions/route.ts`, agregar handler GET.
- [ ] Recibir query param `sessionId`.
- [ ] Llamar a AppSync query `listSessions` con filtro `sessionId.eq`.
- [ ] Verificar activa y no expirada.
- [ ] Retornar `{ valid: true, session }` o `{ valid: false, reason }`.

### Tarea 2.3: Lógica compartida de sesiones
- [ ] Crear `app/lib/sessions.ts` con funciones reutilizables: `createSession()`, `validateSession()`, `getSessionBySessionId()`.
- [ ] Estas funciones usan el cliente AppSync internamente.
- [ ] Son usadas tanto por las API Routes como por el messageHandler de WhatsApp.

### Tarea 2.4: Pantalla de Login (Frontend)
- [ ] Crear `app/login/page.tsx` como Client Component.
- [ ] Leer parámetro `session` de la URL (useSearchParams).
- [ ] Solicitar permiso de geolocalización al usuario.
- [ ] Mostrar botón de "Iniciar Sesión" que llama a `POST /api/sessions`.
- [ ] Redirigir a `/login/success` tras éxito.

### Tarea 2.5: Pantalla Post-Login (Frontend)
- [ ] Crear `app/login/success/page.tsx`.
- [ ] Mostrar mensaje de confirmación: "Sesión iniciada correctamente".
- [ ] Mostrar indicación de "Puedes volver a WhatsApp".
- [ ] Incluir deep link a WhatsApp (`https://wa.me/`).

---

## Fase 3: Plataforma de Apuestas (Frontend)

### Tarea 3.1: Generador de Sorteos
- [ ] Crear `app/lib/draws.ts` con función que genera sorteos ficticios del día.
- [ ] Sorteos cada hora de 8:00 a 22:00 (15 sorteos por día).
- [ ] Cada sorteo: ID determinístico (fecha+hora hash), nombre, fecha, hora.
- [ ] Exportar función reutilizable para frontend y API.

### Tarea 3.2: Utilidad de formato de moneda
- [ ] Crear `app/lib/formatCurrency.ts`.
- [ ] Usar `Intl.NumberFormat('es-CO', ...)` para formato COP sin decimales.
- [ ] Exportar para uso en componentes y API responses.

### Tarea 3.3: Dashboard Principal
- [ ] Actualizar `app/page.tsx` como dashboard.
- [ ] Mostrar catálogo de 2 juegos obtenidos de `/api/games`.
- [ ] Permitir seleccionar un juego para ver sorteos.
- [ ] Mostrar historial de apuestas realizadas.

### Tarea 3.4: Componentes de Juego (Flujo Secuencial)
- [ ] Crear `app/components/GameCard.tsx` - Tarjeta visual del juego.
- [ ] Crear `app/components/DrawList.tsx` - Lista de sorteos del día para el juego seleccionado.
- [ ] Crear `app/components/BetForm.tsx` - Formulario con flujo secuencial:
  - Al seleccionar un sorteo → se habilita input de número de 4 cifras.
  - Al completar 4 cifras → se habilita input de valor de apuesta ($500 - $2.000).
  - Usar formato de moneda (separadores de miles) en todos los campos de dinero.
  - Botón "Pagar" habilitado solo cuando todos los campos están completos.
- [ ] Crear `app/components/BetHistory.tsx` - Tabla/lista de apuestas realizadas con montos en formato moneda.

### Tarea 3.5: API Routes de Apuestas y Juegos
- [ ] Crear `app/api/bets/route.ts`:
  - POST: valida sesión (vía AppSync), valida datos, llama mutation `createBet`.
  - GET: valida sesión, llama query `listBets` con filtro por sessionId.
- [ ] Crear `app/api/games/route.ts`:
  - GET: llama query `listGames` de AppSync.
- [ ] Crear `app/api/draws/route.ts`:
  - GET: genera sorteos del día en memoria, pagina en bloques de 10, valida sesión.

---

## Fase 4: WhatsApp Integration

### Tarea 4.1: Webhook de WhatsApp
- [ ] Crear `app/api/whatsapp/webhook/route.ts`.
- [ ] GET: Verificación de webhook (validar `hub.verify_token`, responder con `hub.challenge`).
- [ ] POST: Recibir mensajes, extraer datos del mensaje y número de teléfono.
- [ ] Delegar procesamiento al messageHandler.

### Tarea 4.2: Envío de Mensajes
- [ ] Crear `app/lib/whatsapp/sendMessage.ts`.
- [ ] Función para enviar mensajes de texto vía WhatsApp Cloud API.
- [ ] Función para enviar mensajes con botones/listas interactivas.
- [ ] Configurar headers con token de autenticación de Meta.

### Tarea 4.3: Manejador de Mensajes y Estado de Conversación
- [ ] Crear `app/lib/whatsapp/messageHandler.ts`.
- [ ] Crear/actualizar estado de conversación vía AppSync (mutations `createConversation`/`updateConversation`).
- [ ] Implementar flujo de menú principal (opciones 1-4).
- [ ] Implementar flujo de "Iniciar sesión": generar URL dinámica con sessionId, enviarla al usuario.
- [ ] Implementar flujo de "Ver juegos": consultar AppSync `listGames`, listar juegos disponibles.
- [ ] Implementar flujo de "Hacer apuesta": guiar paso a paso (juego → sorteo → número → monto → pagar), guardar vía `createBet`.
- [ ] Implementar flujo de "Ver mis apuestas": consultar AppSync `listBets` con filtro por sessionId.
- [ ] Validar sesión activa en cada interacción de servicio.

### Tarea 4.4: Asociación Sesión-WhatsApp
- [ ] Al recibir un mensaje desde WhatsApp con sessionId, asociar el número de teléfono a la sesión vía `updateSession`.
- [ ] Cuando el usuario vuelve al chat después del login, el bot detecta la sesión activa por número de teléfono (query `listSessions` con filtro `phoneNumber`).
- [ ] Actualizar la lógica de `createSession` para que también busque conversaciones pendientes y las vincule.

---

## Fase 5: Deploy y Configuración Final

### Tarea 5.1: Configuración AWS Amplify
- [ ] Conectar repositorio con AWS Amplify (ya conectado).
- [ ] Configurar variables de entorno en Amplify Console:
  - `APPSYNC_ENDPOINT`
  - `APPSYNC_API_KEY`
  - `AWS_REGION`
  - `WHATSAPP_TOKEN`
  - `WHATSAPP_VERIFY_TOKEN`
  - `WHATSAPP_PHONE_NUMBER_ID`
- [ ] Verificar que el build de Next.js funciona en Amplify.

### Tarea 5.2: Verificación y pruebas
- [ ] Verificar que el build del proyecto compila sin errores (`npm run build`).
- [ ] Probar flujo completo: login → dashboard → apuesta desde web.
- [ ] Probar webhook de WhatsApp con herramienta de pruebas de Meta.
- [ ] Verificar que las API Routes responden correctamente en producción.

### Tarea 5.3: Documentación final
- [ ] Verificar que `.env.example` está actualizado con todas las variables.
- [ ] Verificar que `docs/setup-appsync-cli.md` refleja el estado actual.
- [ ] Documentar configuración de WhatsApp Business API (webhook URL, token, etc.).

---

## Orden de Ejecución
1. ~~Fase 1~~ → Configuración base ✅
2. Fase 2 → Sistema de sesiones (API + frontend login)
3. Fase 3 → Plataforma de apuestas (frontend + API de apuestas)
4. Fase 4 → Integración con WhatsApp
5. Fase 5 → Deploy en Amplify y configuración final
