"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  FolderKanban,
  Send,
  Search,
  History,
  Images,
  LayoutDashboard,
  ListChecks,
  Lock,
  MessageSquareText,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RadioTower,
  StickyNote,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";

const links = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard  },
  { href: "/campaign/new",  label: "New Campaign",  icon: Send           },
  { href: "/campaigns",    label: "Campaigns",    icon: FolderKanban     },
  { href: "/find-numbers", label: "Find Numbers", icon: Search          },
  { href: "/progress",     label: "Live Progress", icon: RadioTower      },
  { href: "/history",      label: "History",      icon: History          },
  { href: "/templates",    label: "Templates",    icon: MessageSquareText },
  { href: "/ads",          label: "Ads",          icon: Images           },
  { href: "/notes",        label: "Notes",        icon: StickyNote       },
  { href: "/lists",        label: "Lists",        icon: ListChecks       },
  { href: "/settings",     label: "Settings",     icon: Settings         },
];

function WhatsAppMark({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.135.561 4.14 1.541 5.874L0 24l6.336-1.521A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.015-1.374l-.36-.214-3.762.903.964-3.674-.234-.375A9.778 9.778 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
    </svg>
  );
}

/* Tooltip that slides in from the right */
function Tip({ label }) {
  return (
    <span
      className={[
        "pointer-events-none absolute left-full top-1/2 z-200 ml-3 -translate-y-1/2",
        "whitespace-nowrap rounded-lg px-2.5 py-1.5",
        "text-[12px] font-medium",
        "border border-zinc-700/80 bg-zinc-900 !text-white shadow-lg",
        "dark:border-neutral-200/80 dark:bg-white dark:!text-neutral-900",
        "opacity-0 translate-x-1 transition-all duration-150",
        "group-hover:opacity-100 group-hover:translate-x-0",
      ].join(" ")}
    >
      {label}
      {/* Arrow */}
      <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-900 dark:border-r-white" />
    </span>
  );
}

/* Single nav / action icon button */
function NavIcon({ href, label, icon: Icon, active, onClick, collapsed }) {
  const base = [
    "relative group flex h-10 items-center rounded-xl",
    "transition-all duration-200",
    collapsed ? "w-10 justify-center" : "w-full justify-start gap-3 px-3",
  ].join(" ");

  const activeStyle = collapsed
    ? "bg-transparent text-emerald-500 dark:text-emerald-400"
    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
  const idleStyle   = [
    "text-neutral-500 hover:bg-neutral-100/80 hover:text-neutral-900",
    "dark:text-zinc-500 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100",
  ].join(" ");

  if (href) {
    return (
      <Link href={href} className={`${base} ${active ? activeStyle : idleStyle}`}>
        <Icon size={18} className={`shrink-0 ${href === "/campaign/new" ? "transform rotate-45" : ""}`} />
        {!collapsed && <span className="truncate text-[13px] font-medium">{label}</span>}
        {collapsed && <Tip label={label} />}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={`${base} ${idleStyle}`}>
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span className="truncate text-[13px] font-medium">{label}</span>}
      {collapsed && <Tip label={label} />}
    </button>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { theme, toggle } = useTheme();
  const [confirmLock, setConfirmLock] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("wa_sidebar_collapsed") === "true"
      : false
  );
  /* Seed from cache so there's no "Checking…" flash on navigation */
  const [status, setStatus] = useState(() =>
    typeof window !== "undefined"
      ? (localStorage.getItem("wa_status_cache") || "disconnected")
      : "disconnected"
  );

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem("wa_sender_unlocked") !== "true") router.replace("/");
  }, [router]);

  useEffect(() => {
    async function poll() {
      try {
        const res  = await fetch("/api/status");
        const data = await res.json();
        setStatus(data.status);
        localStorage.setItem("wa_status_cache", data.status);
      } catch {
        setStatus("disconnected");
      }
    }
    poll();
    /* Poll every 8 s — frequent enough to be useful, slow enough to not flicker */
    const id = setInterval(poll, 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem("wa_sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  function lock() {
    localStorage.removeItem("wa_sender_unlocked");
    router.push("/");
  }

  const logoBg =
    status === "connected"                      ? "bg-emerald-500 shadow-emerald-500/30" :
    status === "connecting" || status === "qr"  ? "bg-amber-400 shadow-amber-400/30" :
                                                "bg-rose-500 shadow-rose-500/30";

  const lockDialog = confirmLock && (
    <div
      className="fixed inset-0 z-[300] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setConfirmLock(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-400">
            <Lock size={18} />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">Lock app?</p>
            <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-zinc-500">You will need to enter the PIN again.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmLock(false)}
            className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={lock}
            className="h-9 rounded-xl border border-rose-500/30 bg-rose-500 px-3 text-[13px] font-semibold text-white shadow-sm shadow-rose-500/20 transition hover:bg-rose-400"
          >
            Lock
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={[
          /* z-30 ensures sidebar always stacks above backdrop-blur cards in main */
          "relative z-30 flex h-full min-h-0 shrink-0 flex-col overflow-hidden",
          collapsed ? "w-[68px] items-center" : "w-[184px]",
          "border-r border-neutral-200/60 bg-white/80 backdrop-blur-xl",
          "dark:border-zinc-800/60 dark:bg-zinc-900/80",
          "py-4 gap-1 transition-[width] duration-200 ease-out",
        ].join(" ")}
      >
      {/* Logo */}
      <div className={`relative group mb-5 flex h-10 ${collapsed ? "w-10 justify-center" : "w-full px-3"}`}>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className={[
            "relative flex h-10 items-center rounded-xl transition-all duration-200",
            collapsed ? "w-10 justify-center" : "w-full justify-start gap-3 px-2",
            "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950",
            "dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
          ].join(" ")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-lg transition-all duration-200",
            "group-hover:scale-0 group-hover:opacity-0",
            logoBg,
          ].join(" ")}>
            <WhatsAppMark className="h-5 w-5 text-white" />
          </span>
          <span className="absolute left-2 flex h-9 w-9 scale-75 items-center justify-center rounded-xl opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </span>
          {!collapsed && (
            <span className="min-w-0 truncate text-[13px] font-semibold text-neutral-800 dark:text-zinc-100">
              WA Sender
            </span>
          )}
        </button>
        {collapsed && (
          <Tip label={
            status === "connected"    ? "WhatsApp connected" :
            status === "qr"           ? "Scan QR code"       :
            status === "connecting"   ? "Connecting…"        :
            status === "checking"     ? "Checking…"          :
                                      "Not connected"
          } />
        )}
      </div>

      {/* Divider */}
      <div className={`${collapsed ? "w-8" : "mx-3 w-auto self-stretch"} mb-2 h-px rounded-full bg-neutral-200 dark:bg-zinc-800`} />

      {/* Main nav */}
      <nav className={`flex flex-1 min-h-0 flex-col gap-1 overflow-y-auto overflow-x-hidden ${collapsed ? "items-center" : "w-full px-3"}`}>
        {links.map((link) => (
          <NavIcon
            key={link.href}
            href={link.href}
            label={link.label}
            icon={link.icon}
            active={pathname === link.href || pathname.startsWith(`${link.href}/`)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Bottom: theme + lock */}
      <div className={`flex flex-col gap-1 overflow-visible border-t border-neutral-100 pt-3 dark:border-zinc-800 ${collapsed ? "items-center" : "mx-3 self-stretch"}`}>
        <NavIcon
          label={theme === "dark" ? "Light mode" : "Dark mode"}
          icon={theme === "dark" ? Sun : Moon}
          onClick={toggle}
          collapsed={collapsed}
        />
        <button
          onClick={() => setConfirmLock(true)}
          className={[
            "relative group flex h-10 items-center rounded-xl",
            collapsed ? "w-10 justify-center" : "w-full justify-start gap-3 px-3",
            "text-rose-400 transition-all duration-200",
            "hover:bg-rose-50 hover:text-rose-600",
            "dark:text-rose-500 dark:hover:bg-rose-500/10",
          ].join(" ")}
        >
          <Lock size={18} className="shrink-0" />
          {!collapsed && <span className="truncate text-[13px] font-medium">Lock</span>}
          {collapsed && <Tip label="Lock" />}
        </button>
      </div>

      </aside>
      {mounted && lockDialog ? createPortal(lockDialog, document.body) : null}
    </>
  );
}
