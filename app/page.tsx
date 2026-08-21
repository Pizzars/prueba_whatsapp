export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black text-white font-sans px-6">
      <main className="flex flex-col items-center text-center gap-8 max-w-lg">
        <div className="text-6xl">🎰</div>
        <h1 className="text-4xl font-bold tracking-tight">
          Plataforma de Apuestas
        </h1>
        <p className="text-lg text-zinc-400 leading-relaxed">
          Estamos construyendo algo increíble. Pronto podrás interactuar con
          nuestro chatbot de WhatsApp para realizar apuestas en sorteos
          ficticios.
        </p>
        <div className="flex items-center gap-3 rounded-full border border-zinc-700 bg-zinc-800/50 px-5 py-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-yellow-500"></span>
          </span>
          <span className="text-sm text-zinc-300">En construcción</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-zinc-500">
          <div className="flex flex-col items-center gap-1 rounded-lg border border-zinc-800 p-4">
            <span className="text-2xl">💬</span>
            <span>WhatsApp Bot</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg border border-zinc-800 p-4">
            <span className="text-2xl">🎲</span>
            <span>Sorteos en vivo</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg border border-zinc-800 p-4">
            <span className="text-2xl">📱</span>
            <span>Login dinámico</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg border border-zinc-800 p-4">
            <span className="text-2xl">💰</span>
            <span>Apuestas ficticias</span>
          </div>
        </div>
      </main>
    </div>
  );
}
