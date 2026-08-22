"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import GameCard from "@/app/components/GameCard";
import DrawList from "@/app/components/DrawList";
import BetForm, { BetResult } from "@/app/components/BetForm";
import BetHistory from "@/app/components/BetHistory";
import { formatCurrency } from "@/app/lib/formatCurrency";

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

type Tab = "juegos" | "apuestas";

export default function Dashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("juegos");
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [selectedDraw, setSelectedDraw] = useState<Draw | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadingDraws, setLoadingDraws] = useState(false);
  const [loadingBets, setLoadingBets] = useState(true);
  const [validating, setValidating] = useState(true);
  const [betResult, setBetResult] = useState<BetResult | null>(null);

  // Validar sesión al cargar
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!storedToken) {
      router.push("/login");
      return;
    }

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
        setUser(
          storedUser
            ? JSON.parse(storedUser)
            : { nombre: data.session.nombre, documento: data.session.documento }
        );
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

  function handleSelectGame(game: Game) {
    setSelectedGame(game);
    setSelectedDraw(null);
  }

  function handleBackToGames() {
    setSelectedGame(null);
    setSelectedDraw(null);
    setDraws([]);
  }

  function handleBetSuccess(result: BetResult) {
    setBetResult(result);
    loadBets();
  }

  function handleBackToHome() {
    setBetResult(null);
    setSelectedGame(null);
    setSelectedDraw(null);
    setDraws([]);
  }

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

  // Pantalla de apuesta exitosa
  if (betResult) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black px-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Apuesta exitosa
          </h1>
          <p className="text-zinc-400 mb-8">
            Tu apuesta ha sido registrada correctamente
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left space-y-3 mb-8">
            <div className="flex justify-between">
              <span className="text-sm text-zinc-400">Juego</span>
              <span className="text-sm text-white">
                {betResult.gameIcon} {betResult.gameName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-zinc-400">Sorteo</span>
              <span className="text-sm text-white">{betResult.drawName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-zinc-400">Número</span>
              <span className="text-sm font-mono text-white">
                {betResult.number}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-zinc-400">Monto</span>
              <span className="text-sm font-semibold text-yellow-400">
                {formatCurrency(betResult.amount)}
              </span>
            </div>
          </div>

          <button
            onClick={handleBackToHome}
            className="w-full rounded-lg bg-yellow-500 px-4 py-3 font-semibold text-black transition-colors hover:bg-yellow-400"
          >
            Volver a juegos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
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

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
          <button
            onClick={() => setActiveTab("juegos")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "juegos"
                ? "bg-yellow-500 text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            🎲 Juegos
          </button>
          <button
            onClick={() => setActiveTab("apuestas")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "apuestas"
                ? "bg-yellow-500 text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            📋 Mis apuestas
          </button>
        </div>

        {/* Tab: Juegos */}
        {activeTab === "juegos" && (
          <>
            {!selectedGame ? (
              <section>
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
                        selected={false}
                        onSelect={handleSelectGame}
                      />
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section className="space-y-4">
                {/* Header del juego seleccionado */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleBackToGames}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white"
                  >
                    ←
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selectedGame.icon}</span>
                    <h2 className="text-lg font-semibold text-white">
                      {selectedGame.name}
                    </h2>
                  </div>
                </div>

                {/* Sorteos */}
                <DrawList
                  draws={draws}
                  selectedDrawId={selectedDraw?.id || null}
                  onSelectDraw={setSelectedDraw}
                  loading={loadingDraws}
                />

                {/* Formulario de apuesta */}
                <BetForm
                  selectedDraw={selectedDraw}
                  gameId={selectedGame.id}
                  gameName={selectedGame.name}
                  gameIcon={selectedGame.icon}
                  token={token!}
                  onBetSuccess={handleBetSuccess}
                />
              </section>
            )}
          </>
        )}

        {/* Tab: Mis apuestas */}
        {activeTab === "apuestas" && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-white">
              Mis apuestas
            </h2>
            <BetHistory bets={bets} loading={loadingBets} />
          </section>
        )}
      </div>
    </div>
  );
}
