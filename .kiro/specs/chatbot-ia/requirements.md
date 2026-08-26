# Requisitos — Chatbot IA con Gemini para WhatsApp

## Descripción General

Reemplazar el flujo conversacional basado en estados rígidos por un chatbot inteligente que usa Gemini 2.5 Flash para interpretar las intenciones del usuario de forma natural. El chatbot debe poder guiar al usuario, extraer datos parciales de sus mensajes, recordar contexto, y ejecutar acciones (apuestas, consultas) cuando tenga toda la información necesaria.

---

## Objetivos

1. **Conversación natural** — El usuario puede escribir en lenguaje libre, no necesita seguir menús numerados.
2. **Extracción de datos parciales** — Si el usuario dice "quiero apostar a chance con el 1234", el bot identifica juego y número, y solo pide lo que falta (sorteo y monto).
3. **Orientación proactiva** — Si el usuario no sabe qué hacer, el bot le explica las opciones disponibles de forma amigable.
4. **Ejecución de acciones** — Cuando tiene todos los datos, ejecuta la acción (crear apuesta, consultar historial, etc.) llamando a los servicios existentes.
5. **Autenticación integrada** — El bot sabe que necesita sesión activa para operar y guía el login si no hay sesión.

---

## Requisitos Funcionales

### RF-01: Personalidad del chatbot
- Tono amigable, informal, en español colombiano.
- Se presenta como "asistente de la Plataforma de Apuestas".
- Usa emojis moderadamente.
- Es conciso — no da párrafos largos, va al punto.

### RF-02: Intenciones que debe reconocer
- **Saludar** — Responde con bienvenida y explica qué puede hacer.
- **Quiero apostar** — Inicia flujo de apuesta. Extrae datos que el usuario ya dio (juego, número, sorteo, monto). Pide lo que falta.
- **Ver juegos** — Lista los juegos disponibles.
- **Ver sorteos** — Lista los sorteos de un juego (pregunta cuál juego si no lo dijo).
- **Ver mis apuestas** — Muestra el historial de apuestas.
- **Iniciar sesión** — Ofrece las opciones de login (URL o credenciales por chat).
- **Cerrar sesión** — Cierra la sesión y se despide.
- **Preguntas generales** — "¿Cómo funciona?", "¿Cuánto puedo apostar?", "¿Qué juegos hay?" → responde con info.
- **No entiendo / fuera de contexto** — Redirige amablemente a las opciones disponibles.

### RF-03: Extracción inteligente de datos para apuesta
- El bot debe extraer de un solo mensaje (si están presentes):
  - Juego (lotería nacional, chance express)
  - Número (4 cifras)
  - Sorteo (hora del día)
  - Monto (entre $500 y $2.000)
- Lo que el usuario no dé, lo pregunta individualmente.
- Antes de ejecutar la apuesta, confirma con el usuario: "¿Confirmas apuesta de $1.000 al número 1234 en Chance Express, sorteo de las 14:00?"

### RF-04: Manejo de sesión
- Si no hay sesión activa → el bot informa y ofrece opciones de login.
- Si la sesión expiró → informa y pide login de nuevo.
- Todas las acciones (apostar, consultar) requieren sesión.
- El login se puede hacer por URL o por chat (documento + contraseña), como ya existe.

### RF-05: Function Calling (herramientas del bot)
El LLM tiene acceso a estas "herramientas" que puede invocar:

| Herramienta | Descripción | Parámetros |
|-------------|-------------|------------|
| `listar_juegos` | Obtiene juegos disponibles | ninguno |
| `listar_sorteos` | Obtiene sorteos del día | `gameId` |
| `crear_apuesta` | Registra una apuesta | `gameId`, `drawId`, `number`, `amount` |
| `ver_apuestas` | Consulta historial | ninguno |
| `verificar_sesion` | Verifica si hay sesión activa | ninguno |
| `iniciar_sesion_url` | Genera URL de login | ninguno |
| `iniciar_sesion_credenciales` | Login con documento + password | `documento`, `password` |
| `cerrar_sesion` | Cierra la sesión | ninguno |
| `solicitar_ubicacion` | Pide ubicación al usuario | ninguno |

### RF-06: Historial de conversación
- Se guarda el historial reciente de mensajes (últimos 20) para que el LLM tenga contexto.
- Se almacena en la tabla `Conversation_prueba_whatsapp` o en un campo nuevo.
- Se limpia al cerrar sesión o al escribir "terminar".

### RF-07: Respuestas con formato WhatsApp
- El bot puede responder con texto plano.
- Cuando liste sorteos o juegos, usa formato con emojis y numeración.
- Para confirmaciones importantes (apuesta), usa negritas (*texto*).
- Limitar respuestas a máximo 500 caracteres (WhatsApp trunca mensajes muy largos).

### RF-08: Fallback al flujo anterior
- Si Gemini no está disponible (API key no configurada, error, rate limit), el bot cae al flujo de estados rígido que ya existe.
- Esto garantiza que la app siempre funcione.

---

## Requisitos No Funcionales

### RNF-01: Latencia
- La respuesta debe generarse en menos de 5 segundos (WhatsApp timeout).
- Gemini Flash es suficientemente rápido para esto.
- Si la respuesta tarda más, enviar un "⏳ Un momento..." antes de procesar.

### RNF-02: Costos
- Modelo: Gemini 2.5 Flash ($0.15 input / $0.60 output por 1M tokens).
- Costo estimado por mensaje: $0.0002.
- Para la demo: free tier de Google (1.5M tokens/día gratis).

### RNF-03: Seguridad del prompt
- El system prompt no debe ser revelable al usuario.
- El bot debe rechazar intentos de prompt injection ("ignora tus instrucciones...").
- El bot no debe responder sobre temas fuera de la plataforma de apuestas.

---

## Ejemplo de interacción natural

```
Usuario: Hola!
Bot: ¡Hola! 👋 Soy tu asistente de la Plataforma de Apuestas.
     Puedo ayudarte a:
     • Ver los juegos y sorteos disponibles
     • Hacer una apuesta
     • Consultar tus apuestas anteriores
     ¿Qué te gustaría hacer?

Usuario: Quiero apostar a chance con el 1234
Bot: ¡Chance Express con el 1234! 🎯
     Para completar la apuesta necesito:
     • ¿A qué sorteo? (hoy hay de 8:00 a 22:00)
     • ¿Cuánto quieres apostar? ($500 a $2.000)

Usuario: Al de las 2 por mil
Bot: Perfecto. Confirma tu apuesta:
     ⚡ *Chance Express*
     📅 Sorteo de las 14:00
     🔢 Número: 1234
     💰 Monto: $1.000
     ¿La registro?

Usuario: Sí
Bot: ✅ ¡Apuesta registrada! Buena suerte 🍀

Usuario: Dame los sorteos de lotería
Bot: 🎰 *Lotería Nacional* — Sorteos de hoy:
     1. 08:00  2. 09:00  3. 10:00  4. 11:00
     5. 12:00  6. 13:00  7. 14:00  8. 15:00
     9. 16:00  10. 17:00  11. 18:00  12. 19:00
     13. 20:00  14. 21:00  15. 22:00
     ¿A cuál quieres apostar?

Usuario: Oye cuántas apuestas llevo hoy?
Bot: 📋 Llevas 2 apuestas hoy:
     1. ⚡ #1234 — Sorteo 14:00 — $1.000
     2. 🎰 #5678 — Sorteo 10:00 — $500
```

---

## Flujo técnico

```
[Mensaje WhatsApp]
       │
       ▼
[Webhook recibe y parsea]
       │
       ▼
[Obtener conversación + historial de DynamoDB]
       │
       ▼
[Verificar sesión activa]
       │
       ▼
[Enviar a Gemini]:
  - System prompt (personalidad + reglas)
  - Historial de conversación (últimos 20 mensajes)
  - Mensaje actual del usuario
  - Herramientas disponibles (function calling)
  - Contexto de sesión (si hay: nombre, juegos disponibles)
       │
       ▼
[Gemini responde]:
  ├── Texto → enviar al usuario
  └── Function call → ejecutar función → enviar resultado a Gemini → texto final
       │
       ▼
[Guardar mensaje en historial]
[Enviar respuesta por WhatsApp]
```

---

## Arquitectura de archivos (nuevo)

```
app/lib/ai/
├── gemini.ts            # Cliente Gemini configurado
├── tools.ts             # Definición de herramientas (function declarations)
├── system-prompt.ts     # System prompt del chatbot
└── chatbot.ts           # Orquestador: recibe mensaje, llama Gemini, ejecuta tools, retorna respuesta
```

El `messageHandler.ts` existente se simplifica: en vez de un switch de estados, delega al chatbot IA.
