"use client";

interface Draw {
  id: string;
  name: string;
  date: string;
  hour: number;
}

interface DrawListProps {
  draws: Draw[];
  selectedDrawId: string | null;
  onSelectDraw: (draw: Draw) => void;
  loading: boolean;
}

export default function DrawList({
  draws,
  selectedDrawId,
  onSelectDraw,
  loading,
}: DrawListProps) {
  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-zinc-500">
        Cargando sorteos...
      </div>
    );
  }

  if (draws.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-zinc-500">
        No hay sorteos disponibles
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-zinc-400">
        Sorteos de hoy ({draws.length})
      </h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {draws.map((draw) => {
          const isSelected = selectedDrawId === draw.id;
          const hourStr = `${String(draw.hour).padStart(2, "0")}:00`;

          return (
            <button
              key={draw.id}
              onClick={() => onSelectDraw(draw)}
              className={`rounded-lg border px-3 py-2 text-center text-sm transition-all ${
                isSelected
                  ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                  : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {hourStr}
            </button>
          );
        })}
      </div>
    </div>
  );
}
