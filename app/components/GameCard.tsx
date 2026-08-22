"use client";

interface Game {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface GameCardProps {
  game: Game;
  selected: boolean;
  onSelect: (game: Game) => void;
}

export default function GameCard({ game, selected, onSelect }: GameCardProps) {
  return (
    <button
      onClick={() => onSelect(game)}
      className={`w-full rounded-xl border p-5 text-left transition-all ${
        selected
          ? "border-yellow-500 bg-yellow-500/10"
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
      }`}
    >
      <div className="flex items-center gap-4">
        <span className="text-4xl">{game.icon}</span>
        <div>
          <h3 className="text-lg font-semibold text-white">{game.name}</h3>
          <p className="text-sm text-zinc-400">{game.description}</p>
        </div>
      </div>
    </button>
  );
}
