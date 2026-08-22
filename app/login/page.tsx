"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");

  const [documento, setDocumento] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValidDocumento = /^\d{10}$/.test(documento);
  const isValidPassword = password.length > 0;
  const canLogin = isValidDocumento && isValidPassword && !loading;

  async function handleLogin() {
    if (!canLogin) return;

    setLoading(true);
    setError("");

    try {
      // Solicitar ubicación
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        }
      );

      const { latitude, longitude } = position.coords;

      // Llamar al servicio de login
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documento,
          password,
          latitude,
          longitude,
          sessionId: sessionId || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Error al iniciar sesión");
        return;
      }

      // Guardar token en localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirigir según flujo
      if (sessionId) {
        router.push(`/login/success?session=${sessionId}`);
      } else {
        router.push("/");
      }
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        setError(
          "No se pudo obtener tu ubicación. Habilita los permisos de ubicación e intenta de nuevo."
        );
      } else {
        setError("Error al iniciar sesión. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-5xl mb-4">🎰</div>
          <h1 className="text-2xl font-bold text-white">
            Plataforma de Apuestas
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Ingresa tu número de documento para iniciar sesión
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <label
            htmlFor="documento"
            className="mb-2 block text-sm font-medium text-zinc-300"
          >
            Número de documento
          </label>
          <input
            id="documento"
            type="text"
            inputMode="numeric"
            maxLength={10}
            placeholder="Ej: 1023456789"
            value={documento}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "");
              setDocumento(val);
            }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
          />
          <p className="mt-2 text-xs text-zinc-500">
            {documento.length}/10 dígitos
          </p>

          <label
            htmlFor="password"
            className="mb-2 mt-4 block text-sm font-medium text-zinc-300"
          >
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            placeholder="Ingresa tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
          />

          {error && (
            <p className="mt-3 rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={!canLogin}
            className="mt-4 w-full rounded-lg bg-yellow-500 px-4 py-3 font-semibold text-black transition-colors hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>

          <p className="mt-4 text-center text-xs text-zinc-500">
            Se solicitará acceso a tu ubicación
          </p>
        </div>

        {sessionId && (
          <p className="mt-4 text-center text-xs text-zinc-600">
            Sesión vinculada a WhatsApp
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
          <p className="text-zinc-400">Cargando...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
