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
  const [phoneNumber, setPhoneNumber] = useState("573114770120");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar desde caché al inicio
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY_MESSAGES);
    const cachedPhone = localStorage.getItem(CACHE_KEY_PHONE);
    if (cached) setMessages(JSON.parse(cached));
    if (cachedPhone) setPhoneNumber(cachedPhone);
  }, []);

  // Guardar en caché cuando cambian los mensajes
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(CACHE_KEY_MESSAGES, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(CACHE_KEY_PHONE, phoneNumber);
  }, [phoneNumber]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Enviar al webhook real (igual que WhatsApp)
  async function sendWebhook(payload: object): Promise<string> {
    const start = Date.now();
    const res = await fetch("/api/whatsapp/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const duration = Date.now() - start;
    const data = await res.json();
    return `${res.status} (${duration}ms) - ${JSON.stringify(data)}`;
  }

  // Construir payload exacto de WhatsApp para texto
  function buildTextPayload(text: string) {
    return {
      object: "whatsapp_business_account",
      entry: [{
        id: "729348553606955",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15556696973",
              phone_number_id: "1266826483177939",
            },
            contacts: [{ profile: { name: "Test User" }, wa_id: phoneNumber }],
            messages: [{
              from: phoneNumber,
              id: `wamid.test_${Date.now()}`,
              timestamp: String(Math.floor(Date.now() / 1000)),
              text: { body: text },
              type: "text",
            }],
          },
          field: "messages",
        }],
      }],
    };
  }

  // Construir payload para ubicación
  function buildLocationPayload(lat: number, lng: number) {
    return {
      object: "whatsapp_business_account",
      entry: [{
        id: "729348553606955",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15556696973",
              phone_number_id: "1266826483177939",
            },
            contacts: [{ profile: { name: "Test User" }, wa_id: phoneNumber }],
            messages: [{
              from: phoneNumber,
              id: `wamid.test_${Date.now()}`,
              timestamp: String(Math.floor(Date.now() / 1000)),
              location: { latitude: lat, longitude: lng },
              type: "location",
            }],
          },
          field: "messages",
        }],
      }],
    };
  }

  // Construir payload para botón interactivo
  function buildInteractivePayload(id: string, title: string) {
    return {
      object: "whatsapp_business_account",
      entry: [{
        id: "729348553606955",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15556696973",
              phone_number_id: "1266826483177939",
            },
            contacts: [{ profile: { name: "Test User" }, wa_id: phoneNumber }],
            messages: [{
              from: phoneNumber,
              id: `wamid.test_${Date.now()}`,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: "interactive",
              interactive: {
                type: "button_reply",
                button_reply: { id, title },
              },
            }],
          },
          field: "messages",
        }],
      }],
    };
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const payload = buildTextPayload(text);
      const result = await sendWebhook(payload);
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `📤 Webhook: ${result}` },
      ]);
      // Esperar un poco para que el bot procese y responda
      await waitForResponse();
    } catch (err) {
      setMessages((prev) => [...prev, { role: "bot", text: `❌ Error: ${err}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendLocation() {
    if (loading) return;
    setMessages((prev) => [...prev, { role: "user", text: "📍 Ubicación: 4.7119, -74.1170 (Bogotá)" }]);
    setLoading(true);

    try {
      const payload = buildLocationPayload(4.7119, -74.1170);
      const result = await sendWebhook(payload);
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `📤 Webhook: ${result}` },
      ]);
      await waitForResponse();
    } catch (err) {
      setMessages((prev) => [...prev, { role: "bot", text: `❌ Error: ${err}` }]);
    } finally {
      setLoading(false);
    }
  }

  // Esperar respuesta del bot (el webhook procesa async y envía por WhatsApp API)
  // En local no llega a WhatsApp pero podemos mostrar un indicador
  async function waitForResponse() {
    // El webhook responde 200 inmediato, el procesamiento es async.
    // En producción la respuesta llega por WhatsApp.
    // En el test, mostramos que se envió correctamente.
    await new Promise((r) => setTimeout(r, 500));
    setMessages((prev) => [
      ...prev,
      {
        role: "bot",
        text: "💬 Mensaje enviado al webhook. La respuesta se envía por WhatsApp al número " + phoneNumber + ".\n\nEn producción verías la respuesta en el chat de WhatsApp. En local, revisa la consola del servidor para ver los logs del chatbot.",
      },
    ]);
  }

  function handleClear() {
    setMessages([]);
    localStorage.removeItem(CACHE_KEY_MESSAGES);
  }

  function handleFullReset() {
    setMessages([]);
    setPhoneNumber("573114770120");
    localStorage.removeItem(CACHE_KEY_MESSAGES);
    localStorage.removeItem(CACHE_KEY_PHONE);
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-900 to-black">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">🧪 Chat Test</h1>
            <p className="text-xs text-zinc-500">
              Simula WhatsApp → Webhook (mismo flujo real)
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
            >
              Limpiar chat
            </button>
            <button
              onClick={handleFullReset}
              className="rounded-lg border border-red-700 px-3 py-1.5 text-xs text-red-400 hover:text-red-300"
            >
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
            className="w-36 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white"
          />
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-zinc-600">
              Envía un mensaje para simular una conversación de WhatsApp...
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user"
                  ? "justify-end"
                  : msg.role === "system"
                  ? "justify-center"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-yellow-500/20 text-yellow-200"
                    : msg.role === "system"
                    ? "bg-zinc-800/50 text-zinc-500 text-xs italic"
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
              <div className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-400">
                ⏳ Procesando...
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

        {/* Simular acciones */}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={handleSendLocation}
            disabled={loading}
            className="rounded-lg border border-blue-700 bg-blue-900/20 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-900/40 disabled:opacity-50"
          >
            📍 Enviar ubicación
          </button>
        </div>

        {/* Info */}
        <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
          <p className="text-xs text-zinc-500">
            Este chat envía mensajes al webhook real (<code>/api/whatsapp/webhook</code>) con el mismo formato que WhatsApp.
            La sesión se mantiene en DynamoDB asociada al número <strong>{phoneNumber}</strong>.
            Las respuestas del bot se envían por la API de WhatsApp (en producción llegan al chat real).
            En local, revisa los logs de la consola para ver las respuestas.
          </p>
        </div>
      </div>
    </div>
  );
}
