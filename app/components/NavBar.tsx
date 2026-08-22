"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "🎰 Juegos", matchExact: true },
  { href: "/monitor", label: "📊 Monitor", matchExact: false },
  { href: "/config", label: "⚙️ Config", matchExact: false },
  { href: "/login", label: "🔑 Login", matchExact: false },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-center gap-1 overflow-x-auto px-4 py-2">
        {links.map((link) => {
          const isActive = link.matchExact
            ? pathname === link.href
            : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-yellow-500/10 text-yellow-400"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
