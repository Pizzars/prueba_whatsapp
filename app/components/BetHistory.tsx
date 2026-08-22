"use client";

import { formatCurrency } from "@/app/lib/formatCurrency";

interface Bet {
  id: string;
  gameId: string;
  drawName: string;
  number: string;
  amount: number;
  source: string;
  paidAt: string;
  createdAt: string;
}

interface BetHistoryProps {
  bets: Bet[];
  loading: boolean;
}

export default function BetHistory({ bets, loading }: BetHistoryProps) {
  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-zinc-500">
        Cargando historial...
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-center">
        <p className="text-sm text-zinc-500">No has realizado apuestas aún</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bets.map((bet) => (
        <div
          key={bet.id}
          className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-white">
              #{bet.number} — {bet.drawName}
            </p>
            <p className="text-xs text-zinc-500">
              {bet.gameId === "loteria-nacional"
                ? "🎰 Lotería Nacional"
                : "⚡ Chance Express"}{" "}
              · {bet.source === "web" ? "Web" : "WhatsApp"} ·{" "}
              {new Date(bet.createdAt).toLocaleString("es-CO", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <span className="text-sm font-semibold text-yellow-400">
            {formatCurrency(bet.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}
