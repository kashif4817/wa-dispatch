"use client";

import { useEffect, useState } from "react";
import { LogOut, PlugZap, QrCode, RefreshCw, AlertTriangle } from "lucide-react";
import { Button, Section, StatusDot } from "./ui";

export default function ConnectionPanel({ onStatus }) {
  const [state, setState]           = useState({ status: "disconnected" });
  const [showLogout, setShowLogout] = useState(false);

  async function refresh() {
    try {
      const response = await fetch("/api/status");
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
  }

  useEffect(() => {
    fetch("/api/connect", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, state.status === "connected" ? 10000 : 1500);
    return () => clearInterval(interval);
  }, [state.status]);

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

  const tone =
    state.status === "connected" ? "emerald" :
    state.status === "qr" || state.status === "connecting" ? "amber" :
    "zinc";

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
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <p className="text-[14px] leading-6 text-neutral-500 dark:text-zinc-400">
              This app connects as a WhatsApp Web linked device. Use it only for contacts or customers who expect to hear from you.
            </p>

            {state.lastError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {state.lastError}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {state.status === "connected" ? (
                <Button variant="danger" onClick={() => setShowLogout(true)}>
                  <LogOut size={15} /> Logout
                </Button>
              ) : (
                <Button onClick={connect}>
                  <PlugZap size={15} /> Connect
                </Button>
              )}
              <Button variant="neutral" onClick={refresh}>
                <RefreshCw size={15} /> Refresh
              </Button>
            </div>

            {state.me && (
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <Info label="Name" value={state.me.name} />
                <Info label="Number" value={state.me.number} />
                <Info label="Device ID" value={state.me.id} />
              </div>
            )}
          </div>

          {/* QR area */}
          <div className="flex min-h-44 items-center justify-center rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
            {state.status === "qr" && state.qrDataUrl ? (
              <div className="text-center">
                <img src={state.qrDataUrl} alt="WhatsApp QR" className="mx-auto mb-3 rounded-lg bg-white p-2" />
                <p className="text-[11px] font-medium text-neutral-500 dark:text-zinc-500">
                  WhatsApp → Linked Devices → Link a Device
                </p>
              </div>
            ) : (
              <div className="text-center text-neutral-400 dark:text-zinc-600">
                <QrCode className="mx-auto mb-3" size={36} />
                <p className="text-[13px]">
                  {state.status === "connected" ? "Device linked" : "QR will appear here"}
                </p>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Logout confirmation modal */}
      {showLogout && (
        <div
          className="fixed inset-0 z-500 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowLogout(false)}
        >
          <div
            className="w-full max-w-sm mx-4 overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-2xl dark:border-zinc-700/60 dark:bg-zinc-900"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
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

            {/* Actions */}
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

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">{label}</p>
      <p className="mono mt-0.5 truncate text-[13px] text-neutral-800 dark:text-zinc-100">{value}</p>
    </div>
  );
}
