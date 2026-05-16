"use client";

import { useEffect, useState } from "react";
import { LogOut, PlugZap, QrCode, RefreshCw } from "lucide-react";
import { Button, Section, StatusDot } from "./ui";

export default function ConnectionPanel({ onStatus }) {
  const [state, setState] = useState({ status: "disconnected" });

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

  async function logout() {
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

  const tone = state.status === "connected" ? "emerald" : state.status === "qr" || state.status === "connecting" ? "amber" : "zinc";

  return (
    <Section
      title="Connection"
      eyebrow="Baileys linked device"
      icon={PlugZap}
      aside={<div className="flex items-center gap-2 text-sm font-bold capitalize text-zinc-300"><StatusDot tone={tone} pulse={state.status === "connecting"} /> {state.status}</div>}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-zinc-400">
            This app connects as a WhatsApp Web linked device. Use it only for contacts or customers who expect to hear from you.
          </p>
          {state.lastError ? <p className="border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{state.lastError}</p> : null}
          <div className="flex flex-wrap gap-3">
            {state.status === "connected" ? (
              <Button variant="danger" onClick={logout}><LogOut size={16} /> Logout</Button>
            ) : (
              <Button onClick={connect}><PlugZap size={16} /> Connect</Button>
            )}
            <Button variant="neutral" onClick={refresh}><RefreshCw size={16} /> Refresh</Button>
          </div>
          {state.me ? (
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <Info label="Name" value={state.me.name} />
              <Info label="Number" value={state.me.number} />
              <Info label="Device ID" value={state.me.id} />
            </div>
          ) : null}
        </div>
        <div className="flex min-h-48 items-center justify-center border border-zinc-800 bg-black p-4">
          {state.status === "qr" && state.qrDataUrl ? (
            <div className="text-center">
              <img src={state.qrDataUrl} alt="WhatsApp connection QR" className="mx-auto mb-3 bg-white p-2" />
              <p className="text-xs font-bold text-zinc-400">WhatsApp - Linked Devices - Link a Device</p>
            </div>
          ) : (
            <div className="text-center text-zinc-500">
              <QrCode className="mx-auto mb-3" size={38} />
              <p className="text-sm">{state.status === "connected" ? "Device linked" : "QR will appear here"}</p>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function Info({ label, value }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-3">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mono truncate text-sm text-zinc-100">{value}</p>
    </div>
  );
}
