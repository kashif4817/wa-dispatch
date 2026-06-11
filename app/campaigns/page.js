"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ListFilter,
  RotateCcw,
  Search,
  Send,
  SkipForward,
  Users,
  XCircle,
} from "lucide-react";
import Shell from "@/components/Shell";
import { PageSkeleton, TableSkeleton } from "@/components/ui";
import {
  campaignCounts,
  campaignDisplayTitle,
  campaignStatus,
  campaignSubtitle,
  statusLabel,
  statusTone,
} from "@/lib/campaignDisplay";
import { formatTime } from "@/lib/dateFormat";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "Just now";
}

function StatusChip({ status }) {
  const tone = statusTone(status);
  const styles = {
    emerald: "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/15 dark:text-emerald-400",
    amber: "bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/15 dark:text-amber-400",
    rose: "bg-rose-500/15 text-rose-500 ring-1 ring-rose-500/15 dark:text-rose-400",
    sky: "bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/15 dark:text-sky-400",
    neutral: "bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700",
  };

  return (
    <span className={`inline-flex min-w-[92px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-medium leading-none ${styles[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}

function StatTile({ label, value, icon: Icon, tone = "neutral" }) {
  const colors = {
    emerald: "text-emerald-500 dark:text-emerald-400",
    rose: "text-rose-500 dark:text-rose-400",
    amber: "text-amber-500 dark:text-amber-400",
    sky: "text-sky-500 dark:text-sky-400",
    neutral: "text-neutral-900 dark:text-zinc-100",
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">{label}</p>
        <Icon size={14} className="text-neutral-300 dark:text-zinc-600" />
      </div>
      <p className={`mono mt-2 text-[22px] font-semibold leading-none ${colors[tone]}`}>{value}</p>
    </div>
  );
}

function LogStatus({ status }) {
  const cls =
    status === "sent" ? "text-emerald-500 dark:text-emerald-400" :
    status === "failed" ? "text-rose-500 dark:text-rose-400" :
    status === "skipped" ? "text-amber-500 dark:text-amber-400" :
    status === "retrying" ? "text-sky-500 dark:text-sky-400" :
    "text-neutral-400";
  return <span className={`font-medium capitalize ${cls}`}>{status}</span>;
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [logFilter, setLogFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("wa_sender_unlocked") !== "true") router.replace("/");
  }, [router]);

  const loadCampaigns = useCallback(async () => {
    if (!hasSupabaseConfig()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await getSupabase()
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(120);
      setCampaigns(data || []);
      if (!selectedId && data?.[0]?.id) setSelectedId(data[0].id);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  useEffect(() => {
    if (!selectedId) {
      setLogs([]);
      return;
    }
    setLoadingLogs(true);
    getSupabase()
      .from("send_logs")
      .select("*")
      .eq("campaign_id", selectedId)
      .order("sent_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setLogs(data || []);
        setLoadingLogs(false);
      })
      .catch(() => setLoadingLogs(false));
  }, [selectedId]);

  const items = useMemo(() => campaigns.map((campaign, index) => ({
    ...campaign,
    displayTitle: campaignDisplayTitle(campaign, campaigns.length - index - 1),
    subtitle: campaignSubtitle(campaign),
    status: campaignStatus(campaign),
    counts: campaignCounts(campaign),
  })), [campaigns]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      item.displayTitle.toLowerCase().includes(query) ||
      item.subtitle.toLowerCase().includes(query) ||
      String(item.message_text || "").toLowerCase().includes(query) ||
      item.status.toLowerCase().includes(query)
    );
  }, [items, search]);

  const selected = items.find((item) => item.id === selectedId) || filteredItems[0];
  const selectedCounts = selected?.counts || campaignCounts();
  const selectedStatus = selected ? campaignStatus(selected) : "pending";
  const filteredLogs = logFilter === "all" ? logs : logs.filter((log) => log.status === logFilter);
  const successRate = selectedCounts.completed > 0
    ? Math.round((selectedCounts.sent / selectedCounts.completed) * 100)
    : 0;

  return (
    <Shell noPadding>
      {loading ? <PageSkeleton title="Loading campaigns" layout="split" /> : (
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 text-neutral-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-1 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">Campaigns</span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
          <Link href="/history/failed" className="flex h-9 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 text-[12px] font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <RotateCcw size={13} /> Retry Queue
          </Link>
          <div className="ml-2 flex h-9 flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm shadow-neutral-200/40 dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-black/10">
            <Search size={14} className="shrink-0 text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search campaign, status, or message..."
              className="w-full bg-transparent text-[12px] text-neutral-700 placeholder-neutral-400 outline-none dark:text-zinc-200 dark:placeholder-zinc-500"
            />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-[292px] shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-zinc-800">
              <div>
                <p className="text-[13px] font-semibold text-neutral-800 dark:text-zinc-100">Recent Campaigns</p>
                <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-zinc-500">{filteredItems.length} visible</p>
              </div>
              <ListFilter size={15} className="text-neutral-400 dark:text-zinc-600" />
            </div>

            <div className="flex-1 overflow-auto">
              {filteredItems.length === 0 && (
                <div className="p-6 text-center text-[12px] text-neutral-400 dark:text-zinc-500">No campaigns found.</div>
              )}
              {filteredItems.map((item) => {
                const active = item.id === selected?.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedId(item.id); setLogFilter("all"); }}
                    className={`w-full border-b px-4 py-3.5 text-left transition-colors ${
                      active
                        ? "border-neutral-200 bg-white dark:border-zinc-700/50 dark:bg-zinc-800/60"
                        : "border-neutral-200/60 hover:bg-white/70 dark:border-zinc-800/50 dark:hover:bg-zinc-800/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`truncate text-[14px] font-semibold ${active ? "text-neutral-900 dark:text-zinc-50" : "text-neutral-700 dark:text-zinc-300"}`}>
                          {item.displayTitle}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-neutral-400 dark:text-zinc-500">{item.subtitle}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-neutral-400 dark:text-zinc-600">{timeAgo(item.created_at)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <StatusChip status={item.status} />
                      <span className="mono text-[11px] text-neutral-400 dark:text-zinc-500">{item.counts.pct}%</span>
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-neutral-100 dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.status === "failed" ? "bg-rose-400" :
                          item.status === "partial" ? "bg-amber-400" :
                          item.status === "retrying" ? "bg-sky-400" :
                          "bg-emerald-500"
                        }`}
                        style={{ width: `${item.counts.pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {selected ? (
              <>
                <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="min-w-0">
                    <h1 className="truncate text-[17px] font-semibold tracking-tight text-neutral-900 dark:text-zinc-50">{selected.displayTitle}</h1>
                    <p className="mt-0.5 truncate text-[12px] text-neutral-400 dark:text-zinc-500">{selected.subtitle}</p>
                  </div>
                  <StatusChip status={selectedStatus} />
                </div>

                <div className="flex-1 overflow-auto p-5">
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
                    <StatTile label="Recipients" value={selectedCounts.total.toLocaleString()} icon={Users} />
                    <StatTile label="Sent" value={selectedCounts.sent.toLocaleString()} icon={Send} tone="emerald" />
                    <StatTile label="Failed" value={selectedCounts.failed.toLocaleString()} icon={XCircle} tone="rose" />
                    <StatTile label="Skipped" value={selectedCounts.skipped.toLocaleString()} icon={SkipForward} tone="amber" />
                    <StatTile label="Remaining" value={selectedCounts.remaining.toLocaleString()} icon={Clock3} tone="sky" />
                    <StatTile label="Success" value={`${successRate}%`} icon={CheckCircle2} tone="emerald" />
                  </div>

                  {selected.message_text && (
                    <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">Message Preview</p>
                      <p className="line-clamp-4 whitespace-pre-wrap text-[13px] leading-6 text-neutral-600 dark:text-zinc-300">{selected.message_text}</p>
                    </div>
                  )}

                  <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm shadow-neutral-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10">
                    <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-zinc-800">
                      <span className="text-[13px] font-semibold text-neutral-700 dark:text-zinc-300">Delivery Log</span>
                      <div className="flex gap-1">
                        {["all", "sent", "failed", "skipped"].map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setLogFilter(filter)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${
                              logFilter === filter
                                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                                : "text-neutral-500 hover:bg-neutral-100 dark:text-zinc-500 dark:hover:bg-zinc-800"
                            }`}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="max-h-[calc(100vh-370px)] overflow-auto">
                      {loadingLogs && <TableSkeleton rows={6} columns={4} />}
                      {!loadingLogs && filteredLogs.length === 0 && <p className="p-4 text-center text-[12px] text-neutral-400 dark:text-zinc-500">No log entries.</p>}
                      {filteredLogs.map((entry, index) => (
                        <div key={entry.id || index} className="grid grid-cols-[32px_minmax(0,1fr)_110px_90px] items-center gap-3 border-b border-neutral-50 px-5 py-2.5 text-[12px] last:border-0 dark:border-zinc-800/50">
                          <span className="mono text-neutral-300 dark:text-zinc-700">{index + 1}</span>
                          <span className="mono truncate text-neutral-600 dark:text-zinc-400">{entry.number}</span>
                          <LogStatus status={entry.status} />
                          <span className="mono text-right text-[10px] text-neutral-300 dark:text-zinc-700">{entry.sent_at ? formatTime(entry.sent_at) : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <CalendarClock size={26} className="text-neutral-300 dark:text-zinc-700" />
                <p className="text-[15px] font-semibold text-neutral-700 dark:text-zinc-300">No campaigns yet</p>
                <Link href="/campaign/new" className="text-[13px] font-medium text-emerald-500 hover:text-emerald-400">Start a new campaign</Link>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </Shell>
  );
}
