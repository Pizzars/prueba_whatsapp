/**
 * Definición de herramientas (function calling) que Gemini puede invocar.
 * Cada herramienta corresponde a una acción que el chatbot puede ejecutar.
 */
export const toolDeclarations = [
  {
    name: "listar_juegos",
    description:
      "Obtiene la lista de juegos de apuestas disponibles en la plataforma. Usar cuando el usuario pregunta qué juegos hay o quiere ver las opciones.",
    parameters: {
      type: "OBJECT" as const,
      properties: {},
    },
  },
  {
    name: "listar_sorteos",
    description:
      "Obtiene los sorteos disponibles del día para un juego específico. Cada sorteo es cada hora de 8:00 a 22:00. Usar cuando el usuario pregunta por sorteos o necesita elegir uno.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        gameId: {
          type: "STRING" as const,
          description:
            'ID del juego. Valores posibles: "loteria-nacional" o "chance-express".',
        },
      },
      required: ["gameId"],
    },
  },
  {
    name: "crear_apuesta",
    description:
      "Registra una apuesta. Solo llamar cuando se tienen TODOS los datos confirmados por el usuario: juego, sorteo, número de 4 cifras y monto entre 500 y 2000. Siempre confirmar con el usuario antes de ejecutar.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        gameId: {
          type: "STRING" as const,
          description:
            'ID del juego: "loteria-nacional" o "chance-express".',
        },
        drawId: {
          type: "STRING" as const,
          description:
            "ID del sorteo. Formato: YYYY-MM-DD-HH-gameId (ej: 2026-08-24-14-chance-express).",
        },
        drawName: {
          type: "STRING" as const,
          description: 'Nombre del sorteo (ej: "Sorteo de las 14:00").',
        },
        number: {
          type: "STRING" as const,
          description: "Número de 4 cifras apostado (ej: 1234).",
        },
        amount: {
          type: "NUMBER" as const,
          description: "Monto de la apuesta en pesos colombianos (500 a 2000).",
        },
      },
      required: ["gameId", "drawId", "drawName", "number", "amount"],
    },
  },
  {
    name: "ver_apuestas",
    description:
      "Consulta el historial de apuestas del usuario en la sesión actual. Usar cuando el usuario pregunta por sus apuestas, cuántas ha hecho, o quiere ver su historial.",
    parameters: {
      type: "OBJECT" as const,
      properties: {},
    },
  },
  {
    name: "verificar_sesion",
    description:
      "Verifica si el usuario tiene una sesión activa. Usar al inicio de la conversación o cuando se necesita confirmar que el usuario está autenticado.",
    parameters: {
      type: "OBJECT" as const,
      properties: {},
    },
  },
  {
    name: "iniciar_sesion_url",
    description:
      "Genera una URL de login para que el usuario inicie sesión desde el navegador. El usuario abrirá la URL, ingresará sus credenciales, y la sesión se activará automáticamente.",
    parameters: {
      type: "OBJECT" as const,
      properties: {},
    },
  },
  {
    name: "iniciar_sesion_credenciales",
    description:
      "Inicia sesión con documento y contraseña directamente desde el chat. Requiere que el usuario haya compartido su ubicación previamente.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        documento: {
          type: "STRING" as const,
          description: "Número de documento del usuario (10 dígitos).",
        },
        password: {
          type: "STRING" as const,
          description: "Contraseña del usuario.",
        },
      },
      required: ["documento", "password"],
    },
  },
  {
    name: "solicitar_ubicacion",
    description:
      "Envía un mensaje interactivo solicitando al usuario que comparta su ubicación GPS. Necesario antes del login por credenciales.",
    parameters: {
      type: "OBJECT" as const,
      properties: {},
    },
  },
  {
    name: "cerrar_sesion",
    description:
      "Cierra la sesión activa del usuario. Usar cuando el usuario quiere salir, cerrar sesión o dice terminar/adiós.",
    parameters: {
      type: "OBJECT" as const,
      properties: {},
    },
  },
];

export const tools = [{ functionDeclarations: toolDeclarations }];
