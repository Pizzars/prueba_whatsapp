"use client";

import { useState, useEffect, useCallback } from "react";

interface Capture {
  id: string;
  method: string;
  receivedAt: string;
  signature: string | null;
  expectedSignature: string | null;
  signatureValid: boolean | null;
  signatureNote: string | null;
  headers: string; // JSON string
  rawBody: string;
  queryString: string | null;
}

export default function CapturePage() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [selected, setSelected] = useState<Capture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/capture/list");
      const data = await res.json();
      if (data.captures) {
        setCaptures(data.captures);
        // Mantener la selección si sigue existiendo; si no, seleccionar la primera.
        setSelected((prev) => {
          if (prev) {
            const stillThere = data.captures.find((c: Capture) => c.id === prev.id);
            if (stillThere) return stillThere;
          }
          return data.captures[0] ?? null;
        });
        setError("");
      } else {
        setError(data.error || "No se pudieron cargar las capturas");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // La carga vive en un async aparte: ningún setState corre de forma síncrona
    // en el cuerpo del effect (evita renders en cascada).
    const controller = new AbortController();
    (async () => {
      if (!controller.signal.aborted) {
        await load();
      }
    })();
    return () => controller.abort();
  }, [load]);

  function parseHeaders(raw: string): Record<string, string> {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  function prettyBody(raw: string): string {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100">
      <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">
            🔐 Captura del Webhook
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Peticiones de Meta tal cual llegan, para inspeccionar la firma{" "}
            <code className="text-yellow-400">X-Hub-Signature-256</code>.
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="rounded-md bg-yellow-500/10 px-3 py-1.5 text-sm font-medium text-yellow-400 hover:bg-yellow-500/20"
        >
          🔄 Refrescar
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && captures.length === 0 ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : captures.length === 0 ? (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 px-4 py-8 text-center text-sm text-zinc-400">
          Aún no hay capturas. Envía un mensaje al número de WhatsApp conectado al
          endpoint <code className="text-yellow-400">/api/whatsapp/capture</code> y
          pulsa Refrescar.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          {/* Lista */}
          <div className="flex flex-col gap-2">
            {captures.map((c) => {
              const isActive = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "border-yellow-500/50 bg-yellow-500/10"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{c.method}</span>
                    <span
                      className={`text-xs ${
                        c.signatureValid
                          ? "text-green-400"
                          : c.signature
                          ? "text-red-400"
                          : "text-zinc-500"
                      }`}
                    >
                      {c.signatureValid
                        ? "✅ válida"
                        : c.signature
                        ? "❌ inválida"
                        : "sin firma"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {new Date(c.receivedAt).toLocaleString()}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detalle */}
          {selected && (
            <div className="flex flex-col gap-4">
              <Section title="Resumen">
                <Row label="Método" value={selected.method} />
                <Row
                  label="Recibido"
                  value={new Date(selected.receivedAt).toLocaleString()}
                />
                {selected.queryString && (
                  <Row label="Query string" value={selected.queryString} mono />
                )}
              </Section>

              <Section title="Verificación de firma">
                <div
                  className={`mb-3 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${
                    selected.signatureValid
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {selected.signatureValid ? "✅ Firma válida" : "❌ Firma inválida"}
                </div>

                <div className="mb-2 text-xs text-zinc-500">
                  Firma recibida de Meta (<code>X-Hub-Signature-256</code>):
                </div>
                <code className="mb-3 block break-all rounded bg-zinc-950 p-3 text-xs text-zinc-300">
                  {selected.signature ?? "(no vino)"}
                </code>

                <div className="mb-2 text-xs text-zinc-500">
                  Firma calculada en el front con el App Secret
                  (<code>HMAC-SHA256(cuerpo, appSecret)</code>):
                </div>
                <code
                  className={`mb-3 block break-all rounded bg-zinc-950 p-3 text-xs ${
                    selected.signatureValid ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {selected.expectedSignature ?? "(no calculada)"}
                </code>

                {selected.signatureNote && (
                  <p className="text-xs text-zinc-400">{selected.signatureNote}</p>
                )}
              </Section>

              <Section title="Headers">
                <pre className="max-h-64 overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-300">
                  {JSON.stringify(parseHeaders(selected.headers), null, 2)}
                </pre>
              </Section>

              <Section title="Cuerpo crudo (sin modificar)">
                <pre className="max-h-96 overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-300">
                  {prettyBody(selected.rawBody)}
                </pre>
                <p className="mt-2 text-xs text-zinc-500">
                  La firma HMAC se calcula sobre estos bytes exactos. El formateo de
                  arriba es solo visual; el valor almacenado es el crudo.
                </p>
              </Section>
            </div>
          )}
        </div>
      )}
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-200">{title}</h2>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-3 py-1 text-sm">
      <span className="w-28 shrink-0 text-zinc-500">{label}</span>
      <span className={mono ? "break-all font-mono text-zinc-300" : "text-zinc-300"}>
        {value}
      </span>
    </div>
  );
}
