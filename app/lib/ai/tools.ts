/**
 * Herramientas que Gemini puede invocar (solo las de apuestas/consultas).
 * Login y sesión se manejan fuera de la IA.
 */
export const toolDeclarations = [
  {
    name: "listar_juegos",
    description:
      "Obtiene la lista de juegos de apuestas disponibles. Usar cuando el usuario pregunta qué juegos hay.",
    parameters: {
      type: "OBJECT" as const,
      properties: {},
    },
  },
  {
    name: "listar_sorteos",
    description:
      "Obtiene los sorteos disponibles del día para un juego. Sorteos cada hora de 8:00 a 22:00.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        gameId: {
          type: "STRING" as const,
          description: 'ID del juego: "loteria-nacional" o "chance-express".',
        },
      },
      required: ["gameId"],
    },
  },
  {
    name: "crear_apuesta",
    description:
      "Registra una apuesta. SOLO llamar cuando se tienen TODOS los datos Y el usuario confirmó. Requiere: juego, sorteo, número (4 cifras), monto (500-2000).",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        gameId: {
          type: "STRING" as const,
          description: 'ID del juego: "loteria-nacional" o "chance-express".',
        },
        drawId: {
          type: "STRING" as const,
          description: "ID del sorteo. Formato: YYYY-MM-DD-HH-gameId.",
        },
        drawName: {
          type: "STRING" as const,
          description: 'Nombre del sorteo (ej: "Sorteo de las 14:00").',
        },
        number: {
          type: "STRING" as const,
          description: "Número de 4 cifras (ej: 1234).",
        },
        amount: {
          type: "NUMBER" as const,
          description: "Monto en COP (500 a 2000).",
        },
      },
      required: ["gameId", "drawId", "drawName", "number", "amount"],
    },
  },
  {
    name: "ver_apuestas",
    description:
      "Consulta el historial de apuestas del usuario. Usar cuando pregunta por sus apuestas o cuántas ha hecho.",
    parameters: {
      type: "OBJECT" as const,
      properties: {},
    },
  },
];

export const tools = [{ functionDeclarations: toolDeclarations }];
