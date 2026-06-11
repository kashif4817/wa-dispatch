"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, RotateCcw, Search, Square, XCircle } from "lucide-react";
import Shell from "@/components/Shell";
import { Button, Section, TableSkeleton } from "@/components/ui";
import { formatDateTime, normalizeDateText } from "@/lib/dateFormat";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

export default function FailedLogsPage() {
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!hasSupabaseConfig()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await getSupabase()
        .from("send_logs")
        .select("*,campaigns(id,name,message_text,image_paths,options)")
        .in("status", ["failed", "skipped", "retrying"])
        .order("sent_at", { ascending: false })
        .limit(500);
      setLogs(data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!retrying && !logs.some((log) => log.status === "retrying")) return;
    const interval = setInterval(load, 1200);
    return () => clearInterval(interval);
  }, [load, logs, retrying]);

  useEffect(() => {
    if (retrying && logs.length > 0 && !logs.some((log) => log.status === "retrying")) {
      setRetrying(false);
      setNotice("Retry finished. Any number still shown here failed or was skipped again.");
    }
  }, [logs, retrying]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter((log) =>
      String(log.number || "").toLowerCase().includes(query) ||
      String(log.name || "").toLowerCase().includes(query) ||
      String(log.error || "").toLowerCase().includes(query) ||
      String(log.status || "").toLowerCase().includes(query) ||
      String(log.campaigns?.name || "").toLowerCase().includes(query)
    );
  }, [logs, search]);

  const selectedSet = new Set(selected);
  const selectedRows = filtered.filter((log) => selectedSet.has(log.id) && (log.status === "failed" || log.status === "skipped"));
  const allSelected = filtered.length > 0 && filtered.every((log) => selectedSet.has(log.id) || log.status === "retrying");

  function toggle(id) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAll() {
    if (allSelected) {
      setSelected([]);
      return;
    }
    setSelected(filtered.filter((log) => log.status === "failed" || log.status === "skipped").map((log) => log.id));
  }

  async function retrySelected() {
    if (!selectedRows.length) return;
    setRetrying(true);
    setNotice("");
    setError("");
    try {
      const groups = new Map();
      for (const row of selectedRows) {
        if (!groups.has(row.campaign_id)) groups.set(row.campaign_id, []);
        groups.get(row.campaign_id).push(row);
      }

      let total = 0;
      for (const [campaignId, rows] of groups) {
        const response = await fetch("/api/resend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId,
            rows: rows.map((row) => ({ id: row.id, number: row.number, name: row.name })),
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not start retry");
        total += data.retried || rows.length;
      }

      setSelected([]);
      setNotice(`Retry started for ${total} failed number${total === 1 ? "" : "s"}. Status updates automatically.`);
      await load();
    } catch (err) {
      setError(err.message || "Could not start retry");
      setRetrying(false);
    }
  }

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-1 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">Failed Logs</span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
          <Link href="/history" className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700">
            <ArrowLeft size={13} /> History
          </Link>
          <Button onClick={retrySelected} disabled={retrying || selectedRows.length === 0}>
            {retrying ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
            Retry selected
          </Button>
          <div className="ml-2 flex h-9 flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm shadow-neutral-200/40 dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-black/10">
            <Search size={14} className="shrink-0 text-neutral-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search failed number, reason, or campaign..." className="w-full bg-transparent text-[12px] text-neutral-700 placeholder-neutral-400 outline-none dark:text-zinc-200 dark:placeholder-zinc-500" />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <Section title="Retry Queue" eyebrow={`${filtered.length} failed, skipped, or retrying logs`}>
            {(notice || error) && (
              <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] ${
                error
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              }`}>
                {error ? <XCircle size={15} /> : <Check size={15} />}
                {error || notice}
              </div>
            )}
            <div className="overflow-auto rounded-xl">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-zinc-800">
                    <th className="w-12 p-3">
                      <button onClick={toggleAll} className="grid h-7 w-7 place-items-center rounded-lg border border-neutral-200 text-neutral-500 dark:border-zinc-700">
                        {allSelected ? <Check size={14} /> : <Square size={14} />}
                      </button>
                    </th>
                    {["Number", "Name", "Campaign", "Status", "Reason", "Last try", "Attachments"].map((heading) => (
                      <th key={heading} className="p-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!loading && filtered.map((log) => {
                    const disabled = log.status === "retrying";
                    return (
                      <tr key={log.id} className="border-b border-neutral-50 hover:bg-neutral-50/80 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40">
                        <td className="p-3">
                          <button disabled={disabled} onClick={() => toggle(log.id)} className={`grid h-7 w-7 place-items-center rounded-lg border transition ${selectedSet.has(log.id) ? "border-emerald-500 bg-emerald-500 text-white" : "border-neutral-200 text-neutral-400 dark:border-zinc-700"} disabled:opacity-40`}>
                            {selectedSet.has(log.id) ? <Check size={14} /> : null}
                          </button>
                        </td>
                        <td className="p-3 mono text-neutral-700 dark:text-zinc-300">{log.number}</td>
                        <td className="p-3 text-neutral-600 dark:text-zinc-400">{log.name || "-"}</td>
                        <td className="p-3">
                          <Link className="font-medium text-neutral-700 underline-offset-4 hover:underline dark:text-zinc-300" href={`/history/${log.campaign_id}`}>
                            {normalizeDateText(log.campaigns?.name || log.campaign_id)}
                          </Link>
                        </td>
                        <td className={`p-3 mono font-medium ${log.status === "failed" ? "text-rose-500" : log.status === "retrying" ? "text-sky-500" : "text-amber-500"}`}>{log.status}</td>
                        <td className="max-w-xs truncate p-3 text-rose-500 dark:text-rose-400">{log.error || "-"}</td>
                        <td className="p-3 mono text-neutral-400 dark:text-zinc-500">{formatDateTime(log.sent_at)}</td>
                        <td className="p-3 mono text-neutral-500 dark:text-zinc-400">{log.campaigns?.image_paths?.length || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {loading && <TableSkeleton rows={8} columns={7} />}
            </div>
          </Section>
        </div>
      </div>
    </Shell>
  );
}
