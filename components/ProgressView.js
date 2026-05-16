"use client";

import { useEffect, useState } from "react";
import { CircleStop, RadioTower } from "lucide-react";
import { Button, Section } from "./ui";

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
    <Section title="Live Progress" eyebrow="Campaign runner" icon={RadioTower} aside={<Button variant="danger" onClick={cancel}><CircleStop size={16} /> Cancel</Button>}>
      <div className="mb-4 h-3 border border-zinc-800 bg-zinc-950">
        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-5">
        <Metric label="Sent" value={progress.sent} tone="text-emerald-300" />
        <Metric label="Failed" value={progress.failed} tone="text-rose-300" />
        <Metric label="Skipped" value={progress.skipped} tone="text-amber-300" />
        <Metric label="Remaining" value={Math.max(0, progress.total - complete)} tone="text-zinc-200" />
        <Metric label="Status" value={progress.status} tone="text-zinc-200" />
      </div>
      <p className="mb-3 text-sm text-zinc-400">Currently sending to: <span className="mono text-zinc-100">{progress.current?.number || "none"}</span> {progress.current?.name || ""}</p>
      <div className="max-h-72 overflow-auto border border-zinc-800 bg-black">
        {(progress.log || []).map((entry, index) => (
          <div key={index} className="grid grid-cols-[120px_1fr] gap-3 border-b border-zinc-900 px-3 py-2 text-sm last:border-0">
            <span className={`mono font-bold ${entry.status === "sent" ? "text-emerald-300" : entry.status === "failed" ? "text-rose-300" : "text-amber-300"}`}>{entry.status}</span>
            <span className="text-zinc-300"><span className="mono text-zinc-500">{entry.number}</span> {entry.message}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-3">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className={`mono truncate text-lg font-black ${tone}`}>{value}</p>
    </div>
  );
}
