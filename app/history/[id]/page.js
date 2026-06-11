"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, History, ImageIcon, Loader2, RadioTower, RotateCcw, Send, Trash2, XCircle } from "lucide-react";
import Shell from "@/components/Shell";
import { Button, PageSkeleton, Section, TableSkeleton } from "@/components/ui";
import { campaignDisplayTitle, campaignStatus, campaignSubtitle } from "@/lib/campaignDisplay";
import { formatDateTime } from "@/lib/dateFormat";
import { getPublicUrl, getSupabase, hasSupabaseConfig } from "@/lib/supabase";

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [logs, setLogs] = useState([]);
  const [retryRows, setRetryRows] = useState([]);
  const [retryOpen, setRetryOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  const [retryNotice, setRetryNotice] = useState("");
  const [liveProgress, setLiveProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!hasSupabaseConfig()) {
      setLoading(false);
      return;
    }
    try {
      const supabase = getSupabase();
      const { data: campaignData } = await supabase.from("campaigns").select("*").eq("id", id).single();
      const { data: campaignIndex } = await supabase.from("campaigns").select("id").order("created_at", { ascending: false });
      const { data: logData } = await supabase.from("send_logs").select("*").eq("campaign_id", id).order("sent_at", { ascending: false });
      const rows = campaignIndex || [];
      const newestIndex = Math.max(0, rows.findIndex((row) => row.id === id));
      const oldestFirstIndex = Math.max(0, rows.length - newestIndex - 1);
      setCampaign(campaignData ? {
        ...campaignData,
        displayTitle: campaignDisplayTitle(campaignData, oldestFirstIndex),
        subtitle: campaignSubtitle(campaignData),
        displayStatus: campaignStatus(campaignData),
      } : null);
      setLogs(logData || []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const refreshProgress = useCallback(async () => {
    try {
      const data = await fetch("/api/progress").then((response) => response.json());
      setLiveProgress(data);
      if (data.id === id && ["done", "cancelled", "error"].includes(data.status)) {
        await load();
        setRetrying(false);
        setRetryNotice(data.failed > 0 ? "Retry finished, but some numbers failed again." : "Retry finished successfully.");
      }
    } catch {
      setLiveProgress(null);
    }
  }, [id, load]);

  useEffect(() => {
    load();
    refreshProgress();
  }, [load, refreshProgress]);

  const resendableLogs = logs.filter((log) => log.status === "failed" || log.status === "skipped");
  const retryingLogs = logs.filter((log) => log.status === "retrying");
  const campaignProgressActive = liveProgress?.id === id && ["running", "retrying", "paused"].includes(liveProgress.status);
  const attachmentCount = campaign?.image_paths?.length || 0;

  useEffect(() => {
    if (!retrying && !campaignProgressActive && retryingLogs.length === 0) return;
    const interval = setInterval(() => {
      load();
      refreshProgress();
    }, 1200);
    return () => clearInterval(interval);
  }, [campaignProgressActive, load, refreshProgress, retrying, retryingLogs.length]);

  const statusCounts = useMemo(() => logs.reduce((acc, log) => {
    acc[log.status] = (acc[log.status] || 0) + 1;
    return acc;
  }, {}), [logs]);

  function exportCsv() {
    const header = "number,name,status,error,sent_at\n";
    const rows = logs
      .map((log) => [log.number, log.name, log.status, log.error, log.sent_at]
        .map((v) => `"${String(v || "").replaceAll('"', '""')}"`)
        .join(","))
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `campaign-${id}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function openRetry(rows = resendableLogs) {
    setRetryRows(rows.map((log) => ({
      id: log.id,
      number: log.number || "",
      name: log.name || "",
      error: log.error || "",
      status: log.status,
    })));
    setRetryError("");
    setRetryNotice("");
    setRetryOpen(true);
  }

  function updateRetryRow(rowId, patch) {
    setRetryRows((rows) => rows.map((row) => row.id === rowId ? { ...row, ...patch } : row));
  }

  async function launchRetry() {
    const recipients = retryRows
      .map((row) => ({ number: row.number.trim(), name: row.name.trim() }))
      .filter((row) => row.number);
    if (!recipients.length) {
      setRetryError("Add at least one number to resend.");
      return;
    }
    setRetrying(true);
    setRetryError("");
    setRetryNotice("");
    try {
      const response = await fetch("/api/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: id,
          rows: retryRows.map((row) => ({
            id: row.id,
            number: row.number.trim(),
            name: row.name.trim(),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRetryError(data.error || "Could not start resend.");
        setRetrying(false);
        return;
      }
      setRetryNotice(`Retry started for ${data.retried} number${data.retried === 1 ? "" : "s"} with ${data.attachmentCount} attachment${data.attachmentCount === 1 ? "" : "s"}.`);
      setRetryOpen(false);
      await load();
      refreshProgress();
    } catch (error) {
      setRetryError(error.message || "Could not start resend.");
      setRetrying(false);
    }
  }

  return (
    <Shell noPadding>
      {loading ? <PageSkeleton title="Loading campaign detail" /> : (
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-1 truncate text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">
            {campaign?.displayTitle || "Campaign detail"}
          </span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
          <Link href="/campaigns" className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700">
            <ArrowLeft size={13} /> Back
          </Link>
          <Link href="/history" className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700">
            <History size={13} /> History
          </Link>
          <button onClick={() => openRetry()} disabled={resendableLogs.length === 0} className="flex h-9 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 text-[12px] font-medium text-amber-700 shadow-sm shadow-amber-200/30 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20">
            <RotateCcw size={13} /> Resend failed
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="flex flex-col gap-5">
            <Section
              title="Overview"
              eyebrow="Campaign info"
              aside={<Button variant="neutral" size="sm" onClick={exportCsv}>Export CSV</Button>}
            >
              <div className="mb-5 grid gap-3 sm:grid-cols-6">
                <StatusBox label="Sent" value={statusCounts.sent || 0} tone="emerald" />
                <StatusBox label="Failed" value={statusCounts.failed || 0} tone="rose" />
                <StatusBox label="Skipped" value={statusCounts.skipped || 0} tone="amber" />
                <StatusBox label="Retrying" value={statusCounts.retrying || 0} tone="sky" />
                <StatusBox label="Partial" value={campaign?.displayStatus === "partial" ? 1 : 0} tone={campaign?.displayStatus === "partial" ? "amber" : "neutral"} />
                <StatusBox label="Attachments" value={attachmentCount} tone={attachmentCount ? "emerald" : "neutral"} />
              </div>
              {campaign?.subtitle && (
                <p className="mb-4 text-[12px] text-neutral-400 dark:text-zinc-500">{campaign.subtitle}</p>
              )}
              {(retryNotice || retryError || campaignProgressActive) && (
                <div className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] ${
                  retryError
                    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                    : campaignProgressActive
                      ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                }`}>
                  {retryError ? <XCircle size={16} className="mt-0.5 shrink-0" /> : campaignProgressActive ? <RadioTower size={16} className="mt-0.5 shrink-0 animate-pulse" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
                  <div>
                    <p className="font-semibold">{retryError ? "Retry failed to start" : campaignProgressActive ? "Retry running" : "Retry update"}</p>
                    <p className="mt-0.5">{retryError || retryNotice || "Updating failed rows in this campaign. Results appear here automatically."}</p>
                  </div>
                </div>
              )}
              {campaign?.message_text && (
                <p className="mb-4 whitespace-pre-wrap text-[14px] leading-7 text-neutral-600 dark:text-zinc-300">
                  {campaign.message_text}
                </p>
              )}
              {(campaign?.image_paths || []).length > 0 && (
                <>
                  <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                    <ImageIcon size={14} /> These attachments will be included when failed logs are resent.
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {campaign.image_paths.map((path) => <AttachmentLink key={path} path={path} />)}
                  </div>
                </>
              )}
              {campaign && attachmentCount === 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  No stored attachments are available for this campaign. New campaigns now save uploaded attachments so retries can include them.
                </div>
              )}
            </Section>

            <Section
              title="Send Log"
              eyebrow={`${logs.length} entries`}
            >
              <div className="overflow-auto rounded-xl">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-neutral-100 dark:border-zinc-800">
                      {["Number", "Name", "Status", "Reason", "Sent at", "Action"].map((h) => (
                        <th key={h} className="p-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && logs.map((log) => (
                      <tr key={log.id} className="border-b border-neutral-50 hover:bg-neutral-50/80 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40">
                        <td className="p-3 mono text-neutral-700 dark:text-zinc-300">{log.number}</td>
                        <td className="p-3 text-neutral-600 dark:text-zinc-400">{log.name}</td>
                        <td className={`p-3 mono font-medium ${
                          log.status === "sent" ? "text-emerald-500 dark:text-emerald-400" :
                          log.status === "failed" ? "text-rose-500 dark:text-rose-400" :
                          log.status === "retrying" ? "text-sky-500 dark:text-sky-400" :
                          "text-amber-500 dark:text-amber-400"
                        }`}>{log.status}</td>
                        <td className="p-3 text-rose-500 dark:text-rose-400">{log.error || "-"}</td>
                        <td className="p-3 mono text-neutral-400 dark:text-zinc-500">{formatDateTime(log.sent_at)}</td>
                        <td className="p-3">
                          {(log.status === "failed" || log.status === "skipped") && (
                            <Button variant="neutral" size="sm" onClick={() => openRetry([log])}>
                              <RotateCcw size={13} /> Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {loading && <TableSkeleton rows={8} columns={6} />}
              </div>
            </Section>
          </div>
        </div>
      </div>
      )}

      {retryOpen && (
        <div className="fixed inset-0 z-300 flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm">
          <div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <p className="text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">Edit and resend</p>
                <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-zinc-500">Retry updates these same history rows; it does not create duplicate logs.</p>
              </div>
              <Button variant="ghost" onClick={() => setRetryOpen(false)}>Cancel</Button>
            </div>
            <div className="max-h-[58vh] overflow-auto p-5">
              <div className="flex flex-col gap-2">
                <div className="grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[12px] dark:border-zinc-800 dark:bg-zinc-800/40 sm:grid-cols-3">
                  <Step label="1" text={`${retryRows.length} failed/skipped selected`} />
                  <Step label="2" text={`${attachmentCount} stored attachment${attachmentCount === 1 ? "" : "s"} will send`} />
                  <Step label="3" text="Watch status change below" />
                </div>
                {retryRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1fr_160px_1.2fr_36px] items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <input className="field h-10 px-3 mono text-[13px]" value={row.number} onChange={(event) => updateRetryRow(row.id, { number: event.target.value })} />
                    <input className="field h-10 px-3 text-[13px]" value={row.name} onChange={(event) => updateRetryRow(row.id, { name: event.target.value })} placeholder="Name" />
                    <p className="truncate text-[12px] text-rose-500 dark:text-rose-400">{row.error || row.status}</p>
                    <button type="button" onClick={() => setRetryRows((rows) => rows.filter((item) => item.id !== row.id))} className="grid h-9 w-9 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-500/10">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {retryError && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{retryError}</div>}
              {attachmentCount === 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">This old campaign has no stored attachment paths, so only the text can be retried.</div>}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-4 dark:border-zinc-800">
              <Button variant="ghost" onClick={() => setRetryOpen(false)}>Close</Button>
              <Button onClick={launchRetry} disabled={retrying || retryRows.length === 0}>
                {retrying ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                {retrying ? "Starting..." : "Start Resend"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function StatusBox({ label, value, tone }) {
  const colors = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    rose: "text-rose-500 dark:text-rose-400",
    amber: "text-amber-500 dark:text-amber-400",
    sky: "text-sky-500 dark:text-sky-400",
    neutral: "text-neutral-600 dark:text-zinc-300",
  };
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/60">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">{label}</p>
      <p className={`mono mt-1 text-[18px] font-bold ${colors[tone]}`}>{value}</p>
    </div>
  );
}

function Step({ label, text }) {
  return (
    <div className="flex items-center gap-2 text-neutral-600 dark:text-zinc-300">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">{label}</span>
      <span>{text}</span>
    </div>
  );
}

function AttachmentLink({ path }) {
  const url = getPublicUrl("campaign-images", path);
  const name = path.split("/").pop();
  const isImage = /\.(png|jpe?g|webp|gif)$/i.test(name);

  if (isImage) {
    return (
      <img
        src={url}
        alt=""
        className="aspect-square rounded-xl border border-neutral-200 object-cover dark:border-zinc-700"
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex aspect-square flex-col items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-center transition hover:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-800"
    >
      <FileText className="mb-2 text-emerald-500" size={24} />
      <span className="line-clamp-3 break-all text-[11px] font-medium text-neutral-600 dark:text-zinc-300">{name}</span>
    </a>
  );
}
