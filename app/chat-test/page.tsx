"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "bot" | "system";
  text: string;
  duration?: string;
  error?: string;
}

const CACHE_KEY_MESSAGES = "chat-test-messages";
const CACHE_KEY_PHONE = "chat-test-phone";

export default function ChatTestPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("test-573114770120");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar desde caché
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY_MESSAGES);
    const cachedPhone = localStorage.getItem(CACHE_KEY_PHONE);
    if (cached) setMessages(JSON.parse(cached));
    if (cachedPhone) setPhoneNumber(cachedPhone);
  }, []);

  // Guardar en caché
  useEffect(() => {
    if (messages.length > 0) localStorage.setItem(CACHE_KEY_MESSAGES, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(CACHE_KEY_PHONE, phoneNumber);
  }, [phoneNumber]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendToApi(type: string, text?: string, latitude?: number, longitude?: number) {
    try {
      const res = await fetch("/api/chat-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, text, phoneNumber, latitude, longitude }),
      });

      const data = await res.json();

      if (data.success) {
        // Agregar cada mensaje del bot
        const botMessages: Message[] = (data.messages || []).map((m: string) => ({
          role: "bot" as const,
          text: m,
          duration: data.duration,
        }));
        setMessages((prev) => [...prev, ...botMessages]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "bot", text: `❌ ERROR: ${data.error}`, duration: data.duration, error: data.stack },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "bot", text: `❌ Error de conexión: ${err}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);
    await sendToApi("text", text);
  }

  async function handleSendLocation() {
    if (loading) return;
    setMessages((prev) => [...prev, { role: "user", text: "📍 Ubicación: 4.7119, -74.1170 (Bogotá)" }]);
    setLoading(true);
    await sendToApi("location", undefined, 4.7119, -74.1170);
  }

  function handleClear() {
    setMessages([]);
    localStorage.removeItem(CACHE_KEY_MESSAGES);
  }

  function handleFullReset() {
    setMessages([]);
    localStorage.removeItem(CACHE_KEY_MESSAGES);
    localStorage.removeItem(CACHE_KEY_PHONE);
    setPhoneNumber("test-573114770120");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-900 to-black">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">🧪 Chat Test</h1>
            <p className="text-xs text-zinc-500">
              Simula el chatbot completo (sin enviar a WhatsApp)
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleClear} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white">
              Limpiar chat
            </button>
            <button onClick={handleFullReset} className="rounded-lg border border-red-700 px-3 py-1.5 text-xs text-red-400 hover:text-red-300">
              Reset total
            </button>
          </div>
        </div>

        {/* Phone config */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-zinc-500">Número simulado:</span>
          <input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-44 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white"
          />
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-zinc-600">
              Escribe un mensaje para iniciar...
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : msg.role === "system" ? "justify-center" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-yellow-500/20 text-yellow-200"
                  : msg.role === "system"
                  ? "bg-zinc-800/50 text-zinc-500 text-xs italic"
                  : msg.error
                  ? "bg-red-900/30 text-red-300"
                  : "bg-zinc-800 text-zinc-200"
              }`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.duration && <p className="mt-1 text-xs text-zinc-500">{msg.duration}</p>}
                {msg.error && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-red-400">Stack trace</summary>
                    <pre className="mt-1 overflow-x-auto text-xs text-red-400/70">{msg.error}</pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${msg.text}\n\n${msg.error}`)}
                      className="mt-1 rounded bg-red-900/50 px-2 py-0.5 text-xs text-red-300 hover:bg-red-900"
                    >
                      Copiar error
                    </button>
                  </details>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-400">⏳ Pensando...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Escribe un mensaje..."
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-yellow-500 focus:outline-none"
          />
          <button onClick={handleSend} disabled={loading || !input.trim()} className="rounded-lg bg-yellow-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50">
            Enviar
          </button>
        </div>

        {/* Actions */}
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={handleSendLocation} disabled={loading} className="rounded-lg border border-blue-700 bg-blue-900/20 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-900/40 disabled:opacity-50">
            📍 Enviar ubicación
          </button>
        </div>

        {/* Info */}
        <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
          <p className="text-xs text-zinc-500">
            Este chat ejecuta el mismo flujo que WhatsApp pero las respuestas se muestran aquí directamente.
            La sesión se mantiene en DynamoDB con el número <strong>{phoneNumber}</strong>.
            Usa "Reset total" para borrar el chat y empezar de cero.
          </p>
        </div>
      </div>
    </div>
  );
}
