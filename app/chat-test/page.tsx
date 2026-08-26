"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "bot";
  text: string;
  duration?: string;
  error?: string;
}

export default function ChatTestPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<{ role: string; parts: { text: string }[] }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          history,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          { role: "bot", text: data.response, duration: data.duration },
        ]);
        // Actualizar historial
        setHistory((prev) => [
          ...prev,
          { role: "user", parts: [{ text: userMessage }] },
          { role: "model", parts: [{ text: data.response }] },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text: `❌ ERROR: ${data.error}`,
            duration: data.duration,
            error: data.stack,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: `❌ Error de conexión: ${err}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setMessages([]);
    setHistory([]);
    setSessionId(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-900 to-black">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">🧪 Chat Test</h1>
            <p className="text-xs text-zinc-500">
              Prueba el chatbot Gemini sin WhatsApp
            </p>
          </div>
          <button
            onClick={handleClear}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
          >
            Limpiar
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-zinc-600">
              Escribe un mensaje para probar el chatbot...
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-yellow-500/20 text-yellow-200"
                    : msg.error
                    ? "bg-red-900/30 text-red-300"
                    : "bg-zinc-800 text-zinc-200"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.duration && (
                  <p className="mt-1 text-xs text-zinc-500">{msg.duration}</p>
                )}
                {msg.error && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-red-400">
                      Stack trace
                    </summary>
                    <pre className="mt-1 overflow-x-auto text-xs text-red-400/70">
                      {msg.error}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-400">
                ⏳ Pensando...
              </div>
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
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-yellow-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            Enviar
          </button>
        </div>

        {/* Debug info */}
        <div className="mt-2 text-xs text-zinc-600">
          Session: {sessionId || "ninguna"} | Historial: {history.length} mensajes
        </div>
      </div>
    </div>
  );
}
