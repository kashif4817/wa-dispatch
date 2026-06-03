"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, History, Plus, RefreshCw, RotateCcw, Search, Send, XCircle } from "lucide-react";
import Shell from "@/components/Shell";
import { formatDateTime, normalizeDateText } from "@/lib/dateFormat";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

function StatusChip({ campaign }) {
  const sent = campaign.sent || 0;
  const failed = campaign.failed || 0;
  const total = sent + failed;
  const status =
    total === 0 ? "pending" :
    failed === 0 ? "completed" :
    sent === 0 ? "failed" :
    "partial";

  const styles = {
    completed: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
    failed: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
    partial: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
    pending: "bg-neutral-100 text-neutral-500 dark:bg-zinc-800 dark:text-zinc-400",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${styles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function HistoryPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState("");

  async function load() {
    if (!hasSupabaseConfig()) return;
    const supabase = getSupabase();
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    const ids = (data || []).map((c) => c.id);
    if (!ids.length) { setCampaigns([]); return; }

    const { data: failedLogs } = await supabase
      .from("send_logs")
      .select("campaign_id,error,sent_at")
      .in("campaign_id", ids)
      .eq("status", "failed")
      .order("sent_at", { ascending: false });

    const reasons = new Map();
    for (const log of failedLogs || []) {
      if (!reasons.has(log.campaign_id)) reasons.set(log.campaign_id, log.error || "Failed without a reason");
    }

    setCampaigns((data || []).map((c) => ({ ...c, failureReason: reasons.get(c.id) || "" })));
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return campaigns;
    return campaigns.filter((campaign) =>
      normalizeDateText(campaign.name || campaign.id).toLowerCase().includes(query) ||
      (campaign.failureReason || "").toLowerCase().includes(query)
    );
  }, [campaigns, search]);

  const totalSent = campaigns.reduce((sum, campaign) => sum + (campaign.sent || 0), 0);
  const totalFailed = campaigns.reduce((sum, campaign) => sum + (campaign.failed || 0), 0);

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-200/60 bg-white/70 px-4 py-2.5 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/70">
          <span className="mr-1 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">History</span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
          <Link
            href="/campaign/new"
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm shadow-emerald-500/25 transition hover:bg-emerald-400"
          >
            <Plus size={14} /> New Campaign
          </Link>
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <Link
            href="/history/failed"
            className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
          >
            <RotateCcw size={13} /> Failed Retry
          </Link>
          <div className="ml-2 flex flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
            <Search size={14} className="shrink-0 text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search campaign archive..."
              className="w-full bg-transparent text-[12px] text-neutral-700 placeholder-neutral-400 outline-none dark:text-zinc-200 dark:placeholder-zinc-500"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[12px]">
              <Send size={11} className="text-emerald-500" />
              <span className="mono font-semibold text-emerald-600 dark:text-emerald-400">{totalSent.toLocaleString()}</span>
              <span className="text-neutral-400 dark:text-zinc-600">sent</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px]">
              <XCircle size={11} className="text-rose-400" />
              <span className="mono font-semibold text-rose-500 dark:text-rose-400">{totalFailed.toLocaleString()}</span>
              <span className="text-neutral-400 dark:text-zinc-600">failed</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="overflow-hidden rounded-2xl border border-neutral-200/60 bg-white/80 dark:border-zinc-800/60 dark:bg-zinc-900/80">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <History size={15} className="text-emerald-500" />
                <span className="text-[13px] font-semibold text-neutral-700 dark:text-zinc-300">Campaign Archive</span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 px-1.5 text-[10px] font-bold text-neutral-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {filtered.length}
                </span>
              </div>
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-zinc-800/70">
              {filtered.length === 0 && (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                  <p className="text-[14px] font-semibold text-neutral-700 dark:text-zinc-300">No campaigns found</p>
                  <p className="text-[12px] text-neutral-400 dark:text-zinc-500">Start a campaign or adjust your search.</p>
                </div>
              )}

              {filtered.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/history/${campaign.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_110px_110px_190px_110px] items-center gap-4 px-5 py-3.5 text-[12px] transition hover:bg-neutral-50/80 dark:hover:bg-zinc-800/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-neutral-900 dark:text-zinc-100">
                      {normalizeDateText(campaign.name || campaign.id)}
                    </p>
                    <p className="mt-1 truncate text-[12px] text-neutral-500 dark:text-zinc-500">
                      {campaign.failureReason || "No recent failure reason"}
                    </p>
                  </div>
                  <span className="mono text-emerald-500 dark:text-emerald-400">{(campaign.sent || 0).toLocaleString()} sent</span>
                  <span className="mono text-rose-500 dark:text-rose-400">{(campaign.failed || 0).toLocaleString()} failed</span>
                  <span className="mono flex items-center gap-1.5 whitespace-nowrap text-neutral-400 dark:text-zinc-500">
                    <CalendarClock size={12} /> {formatDateTime(campaign.created_at)}
                  </span>
                  <StatusChip campaign={campaign} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
