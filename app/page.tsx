"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import GameCard from "@/app/components/GameCard";
import DrawList from "@/app/components/DrawList";
import BetForm from "@/app/components/BetForm";
import BetHistory from "@/app/components/BetHistory";

interface Game {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface Draw {
  id: string;
  name: string;
  date: string;
  hour: number;
}

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

interface UserInfo {
  nombre: string;
  documento: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [selectedDraw, setSelectedDraw] = useState<Draw | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadingDraws, setLoadingDraws] = useState(false);
  const [loadingBets, setLoadingBets] = useState(true);
  const [validating, setValidating] = useState(true);

  // Validar sesión al cargar
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!storedToken) {
      router.push("/login");
      return;
    }

    // Validar con el backend
    fetch("/api/sessions/validate", {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.valid) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          router.push("/login");
          return;
        }
        setToken(storedToken);
        setUser(storedUser ? JSON.parse(storedUser) : { nombre: data.session.nombre, documento: data.session.documento });
        setValidating(false);
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  // Cargar juegos
  useEffect(() => {
    if (!token) return;

    fetch("/api/games", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setGames(data.games || []);
        setLoadingGames(false);
      })
      .catch(() => setLoadingGames(false));
  }, [token]);

  // Cargar sorteos cuando se selecciona un juego
  useEffect(() => {
    if (!token || !selectedGame) return;

    setLoadingDraws(true);
    setSelectedDraw(null);

    fetch(`/api/draws?gameId=${selectedGame.id}&page=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setDraws(data.draws || []);
        setLoadingDraws(false);
      })
      .catch(() => setLoadingDraws(false));
  }, [token, selectedGame]);

  // Cargar historial de apuestas
  const loadBets = useCallback(() => {
    if (!token) return;

    setLoadingBets(true);
    fetch("/api/bets", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setBets(data.bets || []);
        setLoadingBets(false);
      })
      .catch(() => setLoadingBets(false));
  }, [token]);

  useEffect(() => {
    loadBets();
  }, [loadBets]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
        <p className="text-zinc-400">Verificando sesión...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">🎰 Apuestas</h1>
            {user && (
              <p className="text-sm text-zinc-400">Hola, {user.nombre}</p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Juegos */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Juegos disponibles
          </h2>
          {loadingGames ? (
            <p className="text-sm text-zinc-500">Cargando juegos...</p>
          ) : (
            <div className="space-y-3">
              {games.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  selected={selectedGame?.id === game.id}
                  onSelect={setSelectedGame}
                />
              ))}
            </div>
          )}
        </section>

        {/* Sorteos + Apuesta */}
        {selectedGame && (
          <section className="mb-8 space-y-4">
            <h2 className="text-lg font-semibold text-white">
              {selectedGame.icon} {selectedGame.name} — Sorteos de hoy
            </h2>

            <DrawList
              draws={draws}
              selectedDrawId={selectedDraw?.id || null}
              onSelectDraw={setSelectedDraw}
              loading={loadingDraws}
            />

            <BetForm
              selectedDraw={selectedDraw}
              gameId={selectedGame.id}
              token={token!}
              onBetPlaced={loadBets}
            />
          </section>
        )}

        {/* Historial */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Mis apuestas
          </h2>
          <BetHistory bets={bets} loading={loadingBets} />
        </section>
      </div>
    </div>
  );
}
