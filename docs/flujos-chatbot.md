# Flujos del Chatbot — Antes y Después de la IA

## Parte 1: Flujo de la Plataforma Web

```
┌─────────────────────────────────────────────────────────────┐
│                    PLATAFORMA WEB                            │
└─────────────────────────────────────────────────────────────┘

[Usuario abre la app]
       │
       ▼
┌─ /login ────────────────────────────────────────────────┐
│  • Ingresa documento (10 dígitos)                        │
│  • Ingresa contraseña                                    │
│  • Click "Iniciar Sesión"                                │
│     → Se solicita ubicación GPS del navegador            │
│     → POST /api/auth/login                               │
│        ├── Valida credenciales (usuarios hardcoded)      │
│        ├── Crea sesión en DynamoDB vía AppSync           │
│        ├── Si viene de WhatsApp (sessionId):             │
│        │   → Busca conversación en DynamoDB              │
│        │   → Envía mensaje de bienvenida por WhatsApp    │
│        │   → Redirige a /login/success                   │
│        └── Si es directo: redirige a /                   │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌─ / (Dashboard) ─────────────────────────────────────────┐
│  • Valida sesión (GET /api/sessions/validate)            │
│  • Si no válida → redirige a /login                      │
│                                                          │
│  [Tab: Juegos]                                           │
│  • Lista juegos (GET /api/games → AppSync)               │
│  • Click juego → muestra sorteos (GET /api/draws)        │
│  • Selecciona sorteo → input número (4 cifras)           │
│  • Ingresa número → input monto ($500-$2000)             │
│  • Click Pagar → POST /api/bets → AppSync                │
│  • Pantalla de éxito → botón "Volver a juegos"           │
│                                                          │
│  [Tab: Mis apuestas]                                     │
│  • GET /api/bets → lista historial                       │
└──────────────────────────────────────────────────────────┘
```

---

## Parte 2: Flujo Anterior de WhatsApp (Máquina de Estados)

```
┌─────────────────────────────────────────────────────────────┐
│         FLUJO ANTERIOR — Máquina de estados rígida          │
└─────────────────────────────────────────────────────────────┘

[Usuario envía mensaje]
       │
       ▼
[Webhook POST /api/whatsapp/webhook]
       │
       ▼
[messageHandler lee estado de DynamoDB]
       │
       ▼
┌─ SWITCH por estado ──────────────────────────────────────┐
│                                                          │
│  estado = "new"                                          │
│  └→ Enviar botones: "Ingresar con URL" / "Credenciales" │
│     └→ estado = "choosing_login_method"                  │
│                                                          │
│  estado = "choosing_login_method"                        │
│  ├→ Si eligió URL:                                       │
│  │  └→ Generar UUID, enviar link, estado="awaiting_login"│
│  └→ Si eligió credenciales:                              │
│     └→ Pedir ubicación, estado="awaiting_location"       │
│                                                          │
│  estado = "awaiting_location"                            │
│  ├→ Si NO es ubicación: "Necesito tu ubicación"          │
│  └→ Si es ubicación: guardar, pedir documento            │
│     └→ estado = "awaiting_documento"                     │
│                                                          │
│  estado = "awaiting_documento"                           │
│  ├→ Si no son 10 dígitos: "Debe ser 10 dígitos"         │
│  └→ Si válido: guardar, pedir contraseña                 │
│     └→ estado = "awaiting_password"                      │
│                                                          │
│  estado = "awaiting_password"                            │
│  ├→ Si credenciales incorrectas: volver a documento      │
│  └→ Si correctas: crear sesión, menú principal           │
│     └→ estado = "idle"                                   │
│                                                          │
│  estado = "awaiting_login" (esperando login web)         │
│  ├→ Si sesión existe en DynamoDB: bienvenida + menú      │
│  └→ Si no: "Aún no has iniciado sesión"                  │
│                                                          │
│  estado = "idle" (menú principal)                        │
│  ├→ "1" → Listar juegos → estado = "idle"               │
│  ├→ "2" → Listar juegos para apostar                     │
│  │        └→ estado = "selecting_game"                   │
│  ├→ "3" → Ver apuestas → estado = "idle"                │
│  └→ "4" → Cerrar sesión → estado = "new"                │
│                                                          │
│  estado = "selecting_game"                               │
│  ├→ Si número inválido: "Opción inválida"                │
│  └→ Si válido: mostrar sorteos                           │
│     └→ estado = "selecting_draw"                         │
│                                                          │
│  estado = "selecting_draw"                               │
│  └→ Si válido: pedir número 4 cifras                     │
│     └→ estado = "entering_number"                        │
│                                                          │
│  estado = "entering_number"                              │
│  ├→ Si no son 4 dígitos: "Debe ser 4 dígitos"           │
│  └→ Si válido: pedir monto                              │
│     └→ estado = "entering_amount"                        │
│                                                          │
│  estado = "entering_amount"                              │
│  ├→ Si monto inválido: "Entre $500 y $2000"             │
│  └→ Si válido: crear apuesta, confirmación              │
│     └→ estado = "idle"                                   │
│                                                          │
│  "terminar" (cualquier estado) → cerrar sesión + reset   │
│  "menu" (si autenticado) → volver a idle                 │
└──────────────────────────────────────────────────────────┘

LIMITACIONES:
• El usuario DEBE seguir el flujo paso a paso
• No puede saltar pasos ni dar múltiples datos a la vez
• Si se confunde, queda atrapado en un estado
• No hay lenguaje natural — solo opciones numéricas
• Si escribe "quiero apostar a chance 1234 por mil" NO entiende
```

---

## Parte 3: Flujo Nuevo con IA (Gemini 2.5 Flash)

```
┌─────────────────────────────────────────────────────────────┐
│          FLUJO NUEVO — Gemini AI con Function Calling       │
└─────────────────────────────────────────────────────────────┘

[Usuario envía CUALQUIER mensaje]
       │
       ▼
[Webhook POST /api/whatsapp/webhook]
       │
       ▼
[messageHandler]
  • Obtiene conversación de DynamoDB
  • Extrae texto/ubicación/interactivo del payload
  • Recupera historial de chat (últimos 20 mensajes)
  • Recupera contexto de sesión (sessionId, ubicación)
       │
       ▼
[processChatMessage — Gemini AI]
  • System prompt (personalidad + reglas + herramientas)
  • Historial de conversación
  • Mensaje actual del usuario
  • Contexto: fecha, teléfono, sesión activa sí/no
       │
       ▼
┌─ GEMINI DECIDE ──────────────────────────────────────────┐
│                                                          │
│  ¿Qué intención tiene el usuario?                        │
│                                                          │
│  A) SALUDO / PREGUNTA GENERAL                            │
│     → Responde con texto natural                         │
│     → Explica qué puede hacer                            │
│     → NO llama ninguna herramienta                       │
│                                                          │
│  B) NECESITA SESIÓN (y no tiene)                         │
│     → Llama verificar_sesion → "no activa"               │
│     → Pregunta cómo quiere iniciar sesión                │
│     → Si dice "por URL" → llama iniciar_sesion_url       │
│     → Si dice "por chat" → llama solicitar_ubicacion     │
│       → Después pide documento y contraseña              │
│       → Llama iniciar_sesion_credenciales                │
│                                                          │
│  C) QUIERE APOSTAR (con datos parciales)                 │
│     → Extrae lo que el usuario dio en UN mensaje         │
│     → Ejemplo: "chance 1234" → juego ✓, número ✓        │
│     → Pide lo que falta: sorteo y monto                  │
│     → Cuando tiene TODO → confirma con el usuario        │
│     → Si usuario confirma → llama crear_apuesta          │
│                                                          │
│  D) QUIERE VER JUEGOS                                    │
│     → Llama listar_juegos                                │
│     → Formatea y responde naturalmente                   │
│                                                          │
│  E) QUIERE VER SORTEOS                                   │
│     → Si no dijo juego: pregunta cuál                    │
│     → Llama listar_sorteos(gameId)                       │
│     → Formatea lista de sorteos                          │
│                                                          │
│  F) QUIERE VER APUESTAS                                  │
│     → Llama ver_apuestas                                 │
│     → Formatea historial                                 │
│                                                          │
│  G) QUIERE CERRAR SESIÓN                                 │
│     → Llama cerrar_sesion                                │
│     → Mensaje de despedida                               │
│                                                          │
│  H) FUERA DE CONTEXTO                                    │
│     → "No puedo ayudarte con eso, pero puedo..."         │
│     → Redirige a opciones de la plataforma               │
└──────────────────────────────────────────────────────────┘
       │
       ▼
[Function Calling Loop]
  Gemini puede llamar herramientas → se ejecutan → 
  el resultado vuelve a Gemini → genera respuesta final
       │
       ▼
[Enviar respuesta por WhatsApp]
  • Si se pidió ubicación: enviar mensaje interactivo
  • Texto de respuesta → sendText
  • Guardar historial actualizado en DynamoDB
```

---

## Parte 4: Comparativa Antes vs Después

| Aspecto | Antes (Estados) | Después (Gemini IA) |
|---------|-----------------|---------------------|
| Interacción | Menús numerados, paso a paso | Lenguaje natural libre |
| Datos parciales | No soporta. Un dato a la vez | Extrae múltiples datos de un mensaje |
| "Quiero chance 1234 por mil" | No entiende | Extrae juego, número, monto. Pide solo el sorteo |
| Errores | "Opción inválida" | Responde amablemente, redirige |
| Contexto | Solo el estado actual | 20 mensajes de historial |
| Personalidad | Mensajes genéricos | Tono colombiano, amigable, emojis |
| Flexibilidad | Rígido, un solo camino | Múltiples caminos, adaptativo |
| Fallback | No hay | Si Gemini falla → mensaje de error amigable |
| Velocidad | Inmediata | 1-3 segundos (Gemini Flash) |
| Costo | Gratis | ~$0.0002 por mensaje (free tier gratis) |

---

## Parte 5: Flujo detallado de una apuesta con IA

```
CASO 1: Usuario da TODA la info en un mensaje
─────────────────────────────────────────────────
Usuario: "Quiero apostar a chance con el 4567 al sorteo de las 3 por dos mil"

Gemini analiza:
  • juego: chance-express ✅
  • número: 4567 ✅
  • sorteo: 15:00 (interpreta "las 3" como 15:00) ✅
  • monto: 2000 (interpreta "dos mil") ✅
  • TODOS los datos presentes → CONFIRMAR

Bot: "Confirma tu apuesta:
     ⚡ *Chance Express*
     📅 Sorteo de las 15:00
     🔢 Número: 4567
     💰 Monto: $2.000
     ¿La registro?"

Usuario: "Sí"
  → Gemini llama crear_apuesta(...)
  → Bot: "✅ ¡Apuesta registrada! Buena suerte 🍀"


CASO 2: Usuario da info PARCIAL
─────────────────────────────────────────────────
Usuario: "Quiero apostar a lotería"

Gemini analiza:
  • juego: loteria-nacional ✅
  • número: ❌ falta
  • sorteo: ❌ falta
  • monto: ❌ falta

Bot: "🎰 ¡Lotería Nacional! ¿Qué número de 4 cifras quieres apostar?"

Usuario: "El 7890"

Gemini analiza (con historial):
  • juego: loteria-nacional ✅ (del mensaje anterior)
  • número: 7890 ✅
  • sorteo: ❌ falta
  • monto: ❌ falta

Bot: "Número 7890. ¿A qué sorteo? Hoy hay de 8:00 a 22:00. Y ¿cuánto? ($500-$2.000)"

Usuario: "Al de las 10 por quinientos"

Gemini analiza (con historial):
  • juego: loteria-nacional ✅
  • número: 7890 ✅
  • sorteo: 10:00 ✅
  • monto: 500 ✅
  • CONFIRMAR

Bot: "Confirma:
     🎰 *Lotería Nacional*
     📅 Sorteo de las 10:00
     🔢 Número: 7890
     💰 Monto: $500
     ¿La registro?"


CASO 3: Usuario no sabe qué hay disponible
─────────────────────────────────────────────────
Usuario: "Qué juegos tienen?"

  → Gemini llama listar_juegos()
  → Recibe: [{id:"loteria-nacional",...}, {id:"chance-express",...}]

Bot: "🎲 Tenemos 2 juegos:
     🎰 *Lotería Nacional* — Sorteos cada hora
     ⚡ *Chance Express* — Apuesta rápida
     ¿A cuál quieres apostar?"

Usuario: "Y qué sorteos hay en chance?"

  → Gemini llama listar_sorteos("chance-express")

Bot: "⚡ Sorteos de *Chance Express* hoy:
     08:00, 09:00, 10:00, 11:00, 12:00, 13:00,
     14:00, 15:00, 16:00, 17:00, 18:00, 19:00,
     20:00, 21:00, 22:00
     ¿A cuál le vas?"


CASO 4: Usuario sin sesión
─────────────────────────────────────────────────
Usuario: "Quiero apostar"

  → Gemini llama verificar_sesion()
  → Resultado: { active: false }

Bot: "Para apostar necesitas iniciar sesión primero.
     ¿Cómo prefieres?
     • Te envío un *link* para ingresar desde el navegador
     • O puedes darme tu *documento y contraseña* aquí mismo"

Usuario: "Por aquí, mi documento es 1023456789"

  → Gemini sabe que necesita ubicación primero
  → Llama solicitar_ubicacion()

Bot: "📍 Primero necesito tu ubicación:" [botón compartir ubicación]

[Usuario comparte ubicación]

  → messageHandler detecta tipo "location", guarda lat/lng
  → Envía a Gemini: "[El usuario compartió su ubicación]"

Bot: "✅ Ubicación recibida. Ahora tu contraseña:"

Usuario: "1234567890"

  → Gemini llama iniciar_sesion_credenciales("1023456789", "1234567890")
  → Resultado: { success: true, nombre: "Carlos Martínez" }

Bot: "✅ ¡Bienvenido, Carlos! Tu sesión está activa.
     ¿Qué deseas hacer? Puedo ayudarte a apostar,
     ver juegos o consultar tu historial."
```

---

## Parte 6: Diagrama de componentes internos

```
┌─────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA INTERNA                      │
└─────────────────────────────────────────────────────────────┘

WhatsApp Cloud API
       │ POST (webhook)
       ▼
┌─ app/api/whatsapp/webhook/route.ts ─────────────────────┐
│  • Parsea payload (text/location/interactive)            │
│  • Extrae phoneNumber y tipo                             │
│  • Delega a messageHandler                               │
│  • Responde 200 inmediato                                │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌─ app/lib/whatsapp/messageHandler.ts ────────────────────┐
│  • Obtiene conversación (DynamoDB)                       │
│  • Recupera historial (últimos 20 mensajes)              │
│  • Construye contexto (sesión, ubicación)                │
│  • Llama processChatMessage()                            │
│  • Envía respuesta por WhatsApp                          │
│  • Guarda historial actualizado                          │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌─ app/lib/ai/chatbot.ts ────────────────────────────────┐
│  • Configura Gemini con system prompt + tools            │
│  • Inicia chat con historial                             │
│  • Envía mensaje del usuario                             │
│  • LOOP: si Gemini pide function call                    │
│    → Ejecuta la herramienta                              │
│    → Envía resultado a Gemini                            │
│    → Repite hasta que Gemini dé texto final              │
│  • Retorna texto + flags                                 │
└──────────────────────────────────────────────────────────┘
       │                              │
       ▼                              ▼
┌─ app/lib/ai/ ────────┐    ┌─ Herramientas ejecutan: ───┐
│  gemini.ts (cliente)  │    │  • AppSync (GraphQL)       │
│  tools.ts (9 tools)   │    │  • sessions.ts             │
│  system-prompt.ts     │    │  • draws.ts                │
└───────────────────────┘    │  • users.ts                │
                             │  • formatCurrency.ts       │
                             │  • sendMessage.ts          │
                             └────────────────────────────┘
```

---

## Parte 7: Manejo de errores y edge cases

```
┌─ ¿Qué pasa si...? ──────────────────────────────────────┐
│                                                          │
│  Gemini no responde (timeout/error):                     │
│  → catch en messageHandler                               │
│  → Envía: "😅 Tuve un problema. ¿Intentas de nuevo?"    │
│                                                          │
│  Usuario envía algo que no es texto ni ubicación:         │
│  → Se ignora (no se procesa)                             │
│                                                          │
│  Sesión expirada mientras chatea:                         │
│  → Gemini llama verificar_sesion → "expirada"            │
│  → Responde pidiendo login de nuevo                      │
│                                                          │
│  Usuario intenta prompt injection:                        │
│  → System prompt instruye ignorar y redirigir            │
│  → "No puedo ayudarte con eso, pero puedo..."           │
│                                                          │
│  Datos de apuesta inválidos:                             │
│  → crear_apuesta valida en el servidor                   │
│  → Retorna error a Gemini                                │
│  → Gemini informa al usuario naturalmente                │
│                                                          │
│  Rate limit de Gemini (free tier: 15 req/min):           │
│  → Error capturado en catch                              │
│  → Mensaje de error amigable                             │
└──────────────────────────────────────────────────────────┘
```
