"use client";

import { useState } from "react";

interface Session {
  id: string;
  sessionId: string;
  token: string;
  documento: string;
  nombre: string;
  latitude: number | null;
  longitude: number | null;
  phoneNumber: string | null;
  active: boolean;
  createdAt: string;
  expiresAt: string;
}

interface Conversation {
  id: string;
  phoneNumber: string;
  sessionId: string | null;
  state: string;
  selectedGame: string | null;
  selectedDraw: string | null;
  betNumber: string | null;
  betAmount: number | null;
  updatedAt: string | null;
}

export default function MonitorPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin");
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setSessions(data.sessions || []);
      setConversations(data.conversations || []);
      setLastUpdate(new Date().toLocaleString("es-CO"));
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  function timeRemaining(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expirada";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">📊 Monitor</h1>
            <p className="text-sm text-zinc-400">
              Sesiones y conversaciones de WhatsApp
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-black transition-colors hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>

        {lastUpdate && (
          <p className="mb-4 text-xs text-zinc-500">
            Última actualización: {lastUpdate}
          </p>
        )}

        {error && (
          <p className="mb-4 rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {/* Conversaciones WhatsApp */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-white">
            💬 Conversaciones WhatsApp ({conversations.length})
          </h2>
          {conversations.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No hay conversaciones. Presiona Refrescar.
            </p>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">
                        📱 {conv.phoneNumber}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Estado:{" "}
                        <span className="font-mono text-zinc-300">
                          {conv.state}
                        </span>
                        {conv.sessionId && (
                          <span className="ml-2">
                            | Session: {conv.sessionId.slice(0, 8)}...
                          </span>
                        )}
                      </p>
                      {conv.selectedGame && (
                        <p className="text-xs text-zinc-500">
                          Juego: {conv.selectedGame} | Sorteo:{" "}
                          {conv.selectedDraw || "-"} | Número:{" "}
                          {conv.betNumber || "-"}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-zinc-600">
                      {conv.updatedAt
                        ? new Date(conv.updatedAt).toLocaleString("es-CO", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sesiones */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            🔑 Sesiones ({sessions.length})
          </h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No hay sesiones. Presiona Refrescar.
            </p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const expired = isExpired(session.expiresAt);
                return (
                  <div
                    key={session.id}
                    className={`rounded-lg border p-4 ${
                      expired
                        ? "border-red-900/50 bg-red-900/10"
                        : "border-zinc-800 bg-zinc-900/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {session.nombre || "Sin nombre"}{" "}
                          <span className="text-zinc-500">
                            ({session.documento || "-"})
                          </span>
                        </p>
                        <p className="text-xs text-zinc-500">
                          Phone: {session.phoneNumber || "No asociado"} |
                          SessionId: {session.sessionId.slice(0, 8)}...
                        </p>
                        <p className="text-xs text-zinc-500">
                          Ubicación:{" "}
                          {session.latitude && session.longitude
                            ? `${session.latitude.toFixed(4)}, ${session.longitude.toFixed(4)}`
                            : "No proporcionada"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            expired
                              ? "bg-red-900/50 text-red-400"
                              : "bg-green-900/50 text-green-400"
                          }`}
                        >
                          {expired ? "Expirada" : "Activa"}
                        </span>
                        <p className="mt-1 text-xs text-zinc-500">
                          {timeRemaining(session.expiresAt)}
                        </p>
                        <p className="text-xs text-zinc-600">
                          Creada:{" "}
                          {new Date(session.createdAt).toLocaleString("es-CO", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
