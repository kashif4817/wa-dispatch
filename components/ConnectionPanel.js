"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Phone,
  PlugZap,
  QrCode,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button, Section, StatusDot } from "./ui";

export default function ConnectionPanel({ onStatus }) {
  const [state, setState] = useState({ status: "disconnected" });
  const [showLogout, setShowLogout] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/status");
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Status API returned ${response.status || "non-JSON"} response`);
      }
      const data = await response.json();
      setState(data);
      onStatus?.(data);
    } catch (error) {
      const nextState = {
        status: "disconnected",
        lastError: `Could not reach local status API. ${error.message}`,
      };
      setState(nextState);
      onStatus?.(nextState);
    }
  }, [onStatus]);

  useEffect(() => {
    fetch("/api/connect", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, state.status === "connected" ? 10000 : 1500);
    return () => clearInterval(interval);
  }, [refresh, state.status]);

  async function connect() {
    try {
      setState((current) => ({ ...current, status: "connecting", lastError: null }));
      await fetch("/api/connect", { method: "POST" });
      refresh();
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "disconnected",
        lastError: `Could not reach local connect API. ${error.message}`,
      }));
    }
  }

  async function confirmLogout() {
    setShowLogout(false);
    try {
      await fetch("/api/logout", { method: "POST" });
      refresh();
    } catch (error) {
      setState((current) => ({
        ...current,
        lastError: `Could not reach local logout API. ${error.message}`,
      }));
    }
  }

  const connected = state.status === "connected";
  const tone = connected ? "emerald" : state.status === "qr" || state.status === "connecting" ? "amber" : "zinc";

  return (
    <>
      <Section
        title="WhatsApp Connection"
        eyebrow="Baileys linked device"
        icon={PlugZap}
        aside={
          <div className="flex items-center gap-2 text-[13px] font-medium capitalize text-neutral-600 dark:text-zinc-400">
            <StatusDot tone={tone} pulse={state.status === "connecting"} />
            {state.status}
          </div>
        }
      >
        <div className={connected ? "space-y-4" : "grid gap-6 lg:grid-cols-[1fr_280px]"}>
          <div className="space-y-4">
            <p className="text-[14px] leading-6 text-neutral-500 dark:text-zinc-400">
              This app connects as a WhatsApp Web linked device. Use it only for contacts or customers who expect to hear from you.
            </p>

            {state.lastError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {state.lastError}
              </div>
            )}

            {connected && state.me ? (
              <ConnectedCard me={state.me} onLogout={() => setShowLogout(true)} />
            ) : (
              <Button onClick={connect}>
                <PlugZap size={15} /> Connect
              </Button>
            )}
          </div>

          {!connected && (
            <div className="flex min-h-44 items-center justify-center rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              {state.status === "qr" && state.qrDataUrl ? (
                <div className="text-center">
                  <img src={state.qrDataUrl} alt="WhatsApp QR" className="mx-auto mb-3 rounded-lg bg-white p-2" />
                  <p className="text-[11px] font-medium text-neutral-500 dark:text-zinc-500">
                    WhatsApp - Linked Devices - Link a Device
                  </p>
                </div>
              ) : (
                <div className="text-center text-neutral-400 dark:text-zinc-600">
                  <QrCode className="mx-auto mb-3" size={36} />
                  <p className="text-[13px]">QR will appear here</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Section>

      {showLogout && (
        <div
          className="fixed inset-0 z-500 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowLogout(false)}
        >
          <div
            className="mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-2xl dark:border-zinc-700/60 dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4 p-6 pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/10">
                <AlertTriangle size={18} className="text-rose-500 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-neutral-900 dark:text-zinc-50">
                  Disconnect WhatsApp?
                </h3>
                <p className="mt-1 text-[13px] leading-5 text-neutral-500 dark:text-zinc-400">
                  This will log out your linked device. You will need to scan the QR code again to reconnect and send campaigns.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-6 py-4 dark:border-zinc-800">
              <Button variant="neutral" onClick={() => setShowLogout(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmLogout}>
                <LogOut size={14} /> Yes, Logout
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ConnectedCard({ me, onLogout }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/20">
            <CheckCircle2 size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700/70 dark:text-emerald-300/70">
              Connected account
            </p>
            <h3 className="mt-1 truncate text-[18px] font-semibold text-neutral-900 dark:text-zinc-50">
              {me.name || "Linked WhatsApp"}
            </h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <ConnectionFact icon={Phone} label="Number" value={me.number || "Unknown"} />
              <ConnectionFact icon={ShieldCheck} label="Session" value="Active" />
              <ConnectionFact icon={UserRound} label="Mode" value="Linked device" />
            </div>
          </div>
        </div>
        <Button variant="danger" onClick={onLogout}>
          <LogOut size={15} /> Logout
        </Button>
      </div>
    </div>
  );
}

function ConnectionFact({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-emerald-200/80 bg-white/70 px-3 py-2 dark:border-emerald-500/20 dark:bg-zinc-900/50">
      <Icon size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">{label}</p>
        <p className="truncate text-[12px] font-medium text-neutral-700 dark:text-zinc-200">{value}</p>
      </div>
    </div>
  );
}
