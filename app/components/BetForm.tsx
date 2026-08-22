"use client";

import { useState } from "react";
import { formatCurrency } from "@/app/lib/formatCurrency";

interface BetFormProps {
  selectedDraw: { id: string; name: string } | null;
  gameId: string;
  token: string;
  onBetPlaced: () => void;
}

export default function BetForm({
  selectedDraw,
  gameId,
  token,
  onBetPlaced,
}: BetFormProps) {
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const isNumberValid = /^\d{4}$/.test(number);
  const numAmount = parseInt(amount, 10);
  const isAmountValid = !isNaN(numAmount) && numAmount >= 500 && numAmount <= 2000;
  const canPay = selectedDraw && isNumberValid && isAmountValid && !loading;

  async function handlePay() {
    if (!canPay || !selectedDraw) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/bets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          gameId,
          drawId: selectedDraw.id,
          drawName: selectedDraw.name,
          number,
          amount: numAmount,
          source: "web",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Error al registrar la apuesta");
        return;
      }

      setSuccess(true);
      setNumber("");
      setAmount("");
      onBetPlaced();

      // Limpiar éxito después de 3s
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (!selectedDraw) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
        <p className="text-sm text-zinc-500">
          Selecciona un sorteo para realizar tu apuesta
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-sm text-zinc-400">
        Sorteo seleccionado:{" "}
        <span className="font-medium text-white">{selectedDraw.name}</span>
      </div>

      {/* Número */}
      <div>
        <label
          htmlFor="bet-number"
          className="mb-1 block text-sm font-medium text-zinc-300"
        >
          Número (4 cifras)
        </label>
        <input
          id="bet-number"
          type="text"
          inputMode="numeric"
          maxLength={4}
          placeholder="Ej: 1234"
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
      </div>

      {/* Monto */}
      <div>
        <label
          htmlFor="bet-amount"
          className="mb-1 block text-sm font-medium text-zinc-300"
        >
          Valor de la apuesta ({formatCurrency(500)} - {formatCurrency(2000)})
        </label>
        <input
          id="bet-amount"
          type="text"
          inputMode="numeric"
          placeholder="Ej: 1000"
          value={amount}
          disabled={!isNumberValid}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {amount && !isAmountValid && (
          <p className="mt-1 text-xs text-red-400">
            Monto debe estar entre {formatCurrency(500)} y {formatCurrency(2000)}
          </p>
        )}
        {isAmountValid && (
          <p className="mt-1 text-xs text-zinc-500">
            Apostarás {formatCurrency(numAmount)}
          </p>
        )}
      </div>

      {/* Errores */}
      {error && (
        <p className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Éxito */}
      {success && (
        <p className="rounded-lg bg-green-900/30 px-3 py-2 text-sm text-green-400">
          ✅ Apuesta registrada exitosamente
        </p>
      )}

      {/* Botón Pagar */}
      <button
        onClick={handlePay}
        disabled={!canPay}
        className="w-full rounded-lg bg-yellow-500 px-4 py-3 font-semibold text-black transition-colors hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Procesando..." : `Pagar ${isAmountValid ? formatCurrency(numAmount) : ""}`}
      </button>
    </div>
  );
}
