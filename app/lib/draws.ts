export interface Draw {
  id: string;
  name: string;
  date: string;
  hour: number;
  gameId: string;
}

/**
 * Genera sorteos ficticios del día actual.
 * Sorteos cada hora de 8:00 a 22:00 (15 sorteos por día por juego).
 * IDs determinísticos basados en fecha + hora + gameId.
 */
export function generateDraws(gameId: string, date?: Date): Draw[] {
  const today = date || new Date();
  const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

  const draws: Draw[] = [];

  for (let hour = 8; hour <= 22; hour++) {
    const id = `${dateStr}-${String(hour).padStart(2, "0")}-${gameId}`;
    const hourStr = `${String(hour).padStart(2, "0")}:00`;

    draws.push({
      id,
      name: `Sorteo de las ${hourStr}`,
      date: dateStr,
      hour,
      gameId,
    });
  }

  return draws;
}

/**
 * Pagina sorteos en bloques.
 */
export function paginateDraws(
  draws: Draw[],
  page: number,
  pageSize: number = 10
) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = draws.slice(start, end);
  const totalPages = Math.ceil(draws.length / pageSize);

  return {
    draws: items,
    page,
    totalPages,
    hasMore: page < totalPages,
  };
}
