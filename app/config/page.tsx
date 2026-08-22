"use client";

import { useState, useEffect } from "react";

interface Config {
  whatsappToken: string;
  whatsappPhoneNumberId: string;
  whatsappVerifyToken: string;
  whatsappApiVersion: string;
  testPhoneNumber: string;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Config>({
    whatsappToken: "",
    whatsappPhoneNumberId: "",
    whatsappVerifyToken: "",
    whatsappApiVersion: "v25.0",
    testPhoneNumber: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [testResult, setTestResult] = useState("");

  // Cargar config actual
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          setConfig(data.config);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setMessage("✅ Configuración guardada correctamente");
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch {
      setMessage("❌ Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestMessage() {
    setTesting(true);
    setTestResult("");
    try {
      const res = await fetch("/api/config/test-message", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setTestResult(`✅ Mensaje enviado a ${data.sentTo} (ID: ${data.messageId})`);
      } else {
        setTestResult(`❌ Error: ${JSON.stringify(data.details || data.error)}`);
      }
    } catch {
      setTestResult("❌ Error de conexión");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
        <p className="text-zinc-400">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black px-4 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">⚙️ Configuración WhatsApp</h1>
          <p className="text-sm text-zinc-400">
            Actualiza el token y datos de WhatsApp sin necesidad de redesplegar
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          {/* Token */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              WhatsApp Token
            </label>
            <textarea
              rows={3}
              value={config.whatsappToken}
              onChange={(e) => setConfig({ ...config, whatsappToken: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-500 focus:outline-none"
              placeholder="Bearer token de WhatsApp"
            />
          </div>

          {/* Phone Number ID */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Phone Number ID
            </label>
            <input
              type="text"
              value={config.whatsappPhoneNumberId}
              onChange={(e) => setConfig({ ...config, whatsappPhoneNumberId: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-500 focus:outline-none"
              placeholder="Ej: 1266826483177939"
            />
          </div>

          {/* Verify Token */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Verify Token (para webhook)
            </label>
            <input
              type="text"
              value={config.whatsappVerifyToken}
              onChange={(e) => setConfig({ ...config, whatsappVerifyToken: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-500 focus:outline-none"
              placeholder="Ej: prueba_whatsapp_verify_2024"
            />
          </div>

          {/* API Version */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              API Version
            </label>
            <input
              type="text"
              value={config.whatsappApiVersion}
              onChange={(e) => setConfig({ ...config, whatsappApiVersion: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-500 focus:outline-none"
              placeholder="Ej: v25.0"
            />
          </div>

          {/* Test Phone Number */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Número de pruebas (con código de país)
            </label>
            <input
              type="text"
              value={config.testPhoneNumber}
              onChange={(e) => setConfig({ ...config, testPhoneNumber: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-yellow-500 focus:outline-none"
              placeholder="Ej: 573114770120"
            />
          </div>

          {/* Mensaje de estado */}
          {message && (
            <p className={`rounded-lg px-3 py-2 text-sm ${message.startsWith("✅") ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
              {message}
            </p>
          )}

          {/* Botón guardar */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-yellow-500 px-4 py-3 font-semibold text-black transition-colors hover:bg-yellow-400 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>

        {/* Sección de pruebas */}
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-3 text-lg font-semibold text-white">🧪 Prueba de envío</h2>
          <p className="mb-4 text-sm text-zinc-400">
            Envía un mensaje de prueba al número configurado para verificar que todo funcione.
          </p>

          {testResult && (
            <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${testResult.startsWith("✅") ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
              {testResult}
            </p>
          )}

          <button
            onClick={handleTestMessage}
            disabled={testing || !config.testPhoneNumber}
            className="w-full rounded-lg border border-green-600 bg-green-600/10 px-4 py-3 font-semibold text-green-400 transition-colors hover:bg-green-600/20 disabled:opacity-50"
          >
            {testing ? "Enviando..." : `Enviar mensaje de prueba a ${config.testPhoneNumber || "..."}`}
          </button>
        </div>

        {/* Links */}
        <div className="mt-6 flex gap-4 text-sm">
          <a href="/monitor" className="text-zinc-400 hover:text-white">
            📊 Monitor
          </a>
          <a href="/" className="text-zinc-400 hover:text-white">
            🎰 Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
