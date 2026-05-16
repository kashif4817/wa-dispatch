"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { History, LayoutDashboard, ListChecks, Lock, MessageSquareText, Settings } from "lucide-react";
import { Button } from "./ui";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: History },
  { href: "/templates", label: "Templates", icon: MessageSquareText },
  { href: "/lists", label: "Lists", icon: ListChecks },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("wa_sender_unlocked") !== "true") router.replace("/");
  }, [router]);

  function lock() {
    localStorage.removeItem("wa_sender_unlocked");
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-black/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mono text-[11px] uppercase tracking-wider text-emerald-300">Local linked-device sender</p>
          <h1 className="text-xl font-black text-zinc-50">WhatsApp Campaign Console</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex h-10 items-center gap-2 border px-3 text-sm font-bold transition ${
                  active
                    ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
          <Button variant="danger" onClick={lock}>
            <Lock size={16} /> Lock
          </Button>
        </nav>
      </div>
    </header>
  );
}
