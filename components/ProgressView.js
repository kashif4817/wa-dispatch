"use client";

import { useEffect, useState } from "react";
import { CircleStop, RadioTower } from "lucide-react";
import { Button, Section, StatCard } from "./ui";

export default function ProgressView({ onDone }) {
  const [progress, setProgress] = useState({ total: 0, sent: 0, failed: 0, skipped: 0, log: [], status: "idle" });

  async function refresh() {
    const response = await fetch("/api/progress");
    const data = await response.json();
    setProgress(data);
    if (["done", "cancelled", "error"].includes(data.status)) onDone?.();
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1200);
    return () => clearInterval(interval);
  }, []);

  const complete = progress.sent + progress.failed + progress.skipped;
  const percent = progress.total ? Math.round((complete / progress.total) * 100) : 0;

  async function cancel() {
    await fetch("/api/cancel", { method: "POST" });
    refresh();
  }

  return (
    <Section
      title="Live Progress"
      eyebrow="Campaign runner"
      icon={RadioTower}
      aside={
        <Button variant="danger" size="sm" onClick={cancel}>
          <CircleStop size={14} /> Cancel
        </Button>
      }
    >
      {/* Progress bar */}
      <div className="mb-5 overflow-hidden rounded-full bg-neutral-100 dark:bg-zinc-800">
        <div
          className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Stat cards */}
      <div className="mb-5 grid gap-3 sm:grid-cols-5">
        <StatCard label="Sent" value={progress.sent} tone="emerald" />
        <StatCard label="Failed" value={progress.failed} tone="rose" />
        <StatCard label="Skipped" value={progress.skipped} tone="amber" />
        <StatCard label="Remaining" value={Math.max(0, progress.total - complete)} tone="neutral" />
        <StatCard label="Status" value={progress.status} tone="neutral" />
      </div>

      {/* Current target */}
      <p className="mb-3 text-[13px] text-neutral-500 dark:text-zinc-400">
        Sending to:{" "}
        <span className="mono font-medium text-neutral-800 dark:text-zinc-200">
          {progress.current?.number || "—"}
        </span>{" "}
        {progress.current?.name || ""}
      </p>

      {/* Log */}
      <div className="max-h-72 overflow-auto rounded-xl border border-neutral-200/80 bg-neutral-50 dark:border-zinc-800 dark:bg-zinc-900/50">
        {(progress.log || []).map((entry, index) => (
          <div
            key={index}
            className="grid grid-cols-[100px_1fr] gap-3 border-b border-neutral-100 px-4 py-2.5 text-[13px] last:border-0 dark:border-zinc-800/60"
          >
            <span className={`mono font-semibold ${
              entry.status === "sent" ? "text-emerald-500" :
              entry.status === "failed" ? "text-rose-500" :
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
