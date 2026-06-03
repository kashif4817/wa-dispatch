"use client";

import { useCallback, useEffect, useState } from "react";
import { CirclePause, CirclePlay, CircleStop, RadioTower, RefreshCw } from "lucide-react";
import { Button, Section, StatCard } from "./ui";

export default function ProgressView({ onDone }) {
  const [progress, setProgress] = useState({ total: 0, sent: 0, failed: 0, skipped: 0, log: [], status: "idle" });

  const refresh = useCallback(async () => {
    const response = await fetch("/api/progress");
    const data = await response.json();
    setProgress(data);
    if (["done", "cancelled", "error"].includes(data.status)) onDone?.();
  }, [onDone]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1200);
    return () => clearInterval(interval);
  }, [refresh]);

  const complete = progress.sent + progress.failed + progress.skipped;
  const percent = progress.total ? Math.round((complete / progress.total) * 100) : 0;
  const running = progress.status === "running";
  const paused = progress.status === "paused" || progress.pauseRequested;
  const active = running || paused;

  async function cancel() {
    await fetch("/api/cancel", { method: "POST" });
    refresh();
  }

  async function pause() {
    await fetch("/api/pause", { method: "POST" });
    refresh();
  }

  async function resume() {
    await fetch("/api/resume", { method: "POST" });
    refresh();
  }

  return (
    <Section
      title="Live Progress"
      eyebrow="Campaign runner"
      icon={RadioTower}
      aside={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="neutral" size="sm" onClick={refresh}>
            <RefreshCw size={14} /> Refresh
          </Button>
          {paused ? (
            <Button size="sm" onClick={resume}>
              <CirclePlay size={14} /> Resume
            </Button>
          ) : (
            <Button variant="neutral" size="sm" onClick={pause} disabled={!running}>
              <CirclePause size={14} /> Pause
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={cancel} disabled={!active}>
            <CircleStop size={14} /> Cancel
          </Button>
        </div>
      }
    >
      <div className="mb-5 overflow-hidden rounded-full bg-neutral-100 dark:bg-zinc-800">
        <div
          className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-5">
        <StatCard label="Sent" value={progress.sent} tone="emerald" />
        <StatCard label="Failed" value={progress.failed} tone="rose" />
        <StatCard label="Skipped" value={progress.skipped} tone="amber" />
        <StatCard label="Remaining" value={Math.max(0, progress.total - complete)} tone="neutral" />
        <StatCard label="Status" value={progress.status} tone={paused ? "amber" : "neutral"} />
      </div>

      <p className="mb-3 text-[13px] text-neutral-500 dark:text-zinc-400">
        Sending to:{" "}
        <span className="mono font-medium text-neutral-800 dark:text-zinc-200">
          {progress.current?.number || "-"}
        </span>{" "}
        {progress.current?.name || ""}
      </p>

      {!active && progress.status === "idle" && (
        <div className="mb-5 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-[13px] text-neutral-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
          No campaign is currently running in the background.
        </div>
      )}

      <div className="max-h-72 overflow-auto rounded-xl border border-neutral-200/80 bg-neutral-50 dark:border-zinc-800 dark:bg-zinc-900/50">
        {(progress.log || []).map((entry, index) => (
          <div
            key={`${entry.at || index}-${index}`}
            className="grid grid-cols-[100px_1fr] gap-3 border-b border-neutral-100 px-4 py-2.5 text-[13px] last:border-0 dark:border-zinc-800/60"
          >
            <span className={`mono font-semibold ${
              entry.status === "sent" ? "text-emerald-500" :
              entry.status === "failed" ? "text-rose-500" :
              entry.status === "paused" ? "text-amber-500" :
              "text-amber-500"
            }`}>
              {entry.status}
            </span>
            <span className="text-neutral-600 dark:text-zinc-300">
              <span className="mono text-neutral-400 dark:text-zinc-500">{entry.number}</span>{" "}
              {entry.message}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}
