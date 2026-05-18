"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Play,
  Plus,
  RefreshCw,
  Send,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import Shell from "@/components/Shell";
import { formatTime, normalizeDateText } from "@/lib/dateFormat";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

/* ─── tiny helpers ────────────────────────────────────────────────── */

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
  const map = {
    running:   "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    completed: "bg-emerald-500/12 text-emerald-600 ring-1 ring-emerald-500/15 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/15",
    failed:    "bg-rose-500/15 text-rose-500 dark:text-rose-400",
    partial:   "bg-amber-500/15 text-amber-500 dark:text-amber-400",
  };
  return (
    <span className={`inline-flex min-w-[92px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-medium leading-none ${map[status] ?? map.completed}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function getCampaignStatus(sent, failed) {
  const total = sent + failed;
  if (total === 0 || failed === 0) return "completed";
  if (sent === 0) return "failed";
  return (failed / total) >= 0.5 ? "failed" : "partial";
}

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-zinc-500">{label}</p>
        {Icon && <Icon size={14} className="text-neutral-300 dark:text-zinc-600" />}
      </div>
      <p className={`mono text-[22px] font-semibold leading-none ${color}`}>
        {typeof value === "number" ? value.toLocaleString() : (value ?? "—")}
      </p>
    </div>
  );
}

/* Simple SVG sparkline built from an array of numbers */
function Sparkline({ values = [] }) {
  const w = 200, h = 40, pts = values.length;
  if (pts < 2) {
    return <div className="h-10 w-full rounded bg-neutral-100/60 dark:bg-zinc-800/40" />;
  }
  const max = Math.max(...values, 1);
  const coords = values.map((v, i) => [
    (i / (pts - 1)) * w,
    h - (v / max) * (h - 4) - 2,
  ]);
  const d = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const fill = [...coords, [w, h], [0, h]].map(p => `${p[0]},${p[1]}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-10 w-full">
      <polygon points={fill} className="fill-emerald-500/10" />
      <polyline points={coords.map(p => p.join(",")).join(" ")} fill="none" className="stroke-emerald-500" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ─── main page ───────────────────────────────────────────────────── */

export default function DashboardPage() {
  const router = useRouter();

  const [campaigns, setCampaigns]   = useState([]);
  const [live, setLive]             = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [logs, setLogs]             = useState([]);
  const [logFilter, setLogFilter]   = useState("all");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab]   = useState("Overview");
  const [search, setSearch]         = useState("");
  const [sparkData, setSparkData]   = useState([]);

  /* auth */
  useEffect(() => {
    if (localStorage.getItem("wa_sender_unlocked") !== "true") router.replace("/");
  }, [router]);

  /* live progress poll */
  useEffect(() => {
    async function poll() {
      try {
        const data = await fetch("/api/progress").then(r => r.json());
        if (["running"].includes(data.status) && data.total > 0) {
          setLive(data);
        } else {
          setLive(null);
        }
      } catch { setLive(null); }
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  /* campaign history */
  async function loadCampaigns() {
    if (!hasSupabaseConfig()) return;
    const { data } = await getSupabase()
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setCampaigns(data || []);
  }
  useEffect(() => { loadCampaigns(); }, []);

  /* load logs for selected campaign */
  useEffect(() => {
    if (!selectedId || selectedId === "live") { setLogs([]); setSparkData([]); return; }
    setLoadingLogs(true);
    getSupabase()
      .from("send_logs")
      .select("*")
      .eq("campaign_id", selectedId)
      .order("sent_at", { ascending: true })
      .limit(300)
      .then(({ data }) => {
        const rows = data || [];
        setLogs([...rows].reverse());
        /* build hourly sparkline */
        const buckets = Array(12).fill(0);
        rows.forEach(r => {
          if (!r.sent_at) return;
          const h = new Date(r.sent_at).getHours();
          buckets[h % 12]++;
        });
        setSparkData(buckets);
        setLoadingLogs(false);
      });
  }, [selectedId]);

  /* unified list */
  const liveComplete = live ? live.sent + live.failed + live.skipped : 0;
  const livePct = live?.total ? Math.round((liveComplete / live.total) * 100) : 0;

  const allItems = useMemo(() => [
    ...(live && live.total > 0 ? [{
      id: "live", name: normalizeDateText(live.name || "Active Campaign"), status: "running",
      sent: live.sent, failed: live.failed, total: live.total,
      pct: livePct, createdAt: new Date().toISOString(),
      preview: "Campaign currently in progress…",
    }] : []),
    ...campaigns.map(c => {
      const sent   = c.sent   || 0;
      const failed = c.failed || 0;
      const total  = sent + failed;
      const pct    = total > 0 ? Math.round((sent / total) * 100) : (sent > 0 ? 100 : 0);
      return {
        id: c.id, name: normalizeDateText(c.name || c.id),
        status: getCampaignStatus(sent, failed),
        sent, failed, total, pct,
        createdAt: c.created_at,
        preview: c.message_text ? c.message_text.slice(0, 60) + (c.message_text.length > 60 ? "…" : "") : "",
      };
    }),
  ], [campaigns, live, livePct]);

  const filteredItems = useMemo(() =>
    allItems.filter(c => c.name.toLowerCase().includes(search.toLowerCase())),
    [allItems, search]);

  /* auto-select first */
  useEffect(() => {
    if (filteredItems.length > 0 && !selectedId) setSelectedId(filteredItems[0].id);
  }, [filteredItems.length]);

  const sel    = allItems.find(c => c.id === selectedId);
  const isLive = selectedId === "live";

  /* log rows */
  const rawLogs = isLive
    ? (live?.log || []).map(e => ({ number: e.number, name: e.name, status: e.status, sent_at: null }))
    : logs;
  const filteredLogs = logFilter === "all" ? rawLogs : rawLogs.filter(e => e.status === logFilter);

  function logLabel(status) {
    if (status === "sent")    return { text: "Delivered ✓✓", cls: "text-emerald-500 dark:text-emerald-400" };
    if (status === "failed")  return { text: "Failed",       cls: "text-rose-500 dark:text-rose-400" };
    if (status === "skipped") return { text: "Skipped",      cls: "text-amber-500 dark:text-amber-400" };
    return { text: status, cls: "text-neutral-400" };
  }

  /* ── render ──────────────────────────────────────────────────────── */
  /* aggregate totals across all completed/partial/failed campaigns */
  const totalSentAll   = useMemo(() => campaigns.reduce((s, c) => s + (c.sent   || 0), 0), [campaigns]);
  const totalFailedAll = useMemo(() => campaigns.reduce((s, c) => s + (c.failed || 0), 0), [campaigns]);

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 text-neutral-900 dark:bg-zinc-950 dark:text-zinc-100">

        {/* ══ TOP ACTION BAR ══════════════════════════════════════════ */}
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          {/* Dashboard label */}
          <span className="mr-1 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">Dashboard</span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />

          {/* Left: primary actions */}
          <Link
            href="/campaign/new"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-emerald-500/25 transition hover:bg-emerald-400"
          >
            <Plus size={14} /> New Campaign
          </Link>

          <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />

          <button
            onClick={loadCampaigns}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700"
          >
            <RefreshCw size={13} /> Refresh
          </button>

          {/* Search */}
          <div className="ml-2 flex h-9 flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm shadow-neutral-200/40 dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-black/10">
            <svg className="h-3.5 w-3.5 shrink-0 text-neutral-400" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search campaigns…"
              className="w-full bg-transparent text-[12px] text-neutral-700 placeholder-neutral-400 outline-none dark:text-zinc-200 dark:placeholder-zinc-500"
            />
          </div>

          {/* Right: all-time stats */}
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[12px]">
              <Send size={11} className="text-emerald-500" />
              <span className="mono font-semibold text-emerald-600 dark:text-emerald-400">{totalSentAll.toLocaleString()}</span>
              <span className="text-neutral-400 dark:text-zinc-600">sent</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px]">
              <XCircle size={11} className="text-rose-400" />
              <span className="mono font-semibold text-rose-500 dark:text-rose-400">{totalFailedAll.toLocaleString()}</span>
              <span className="text-neutral-400 dark:text-zinc-600">failed</span>
            </div>
          </div>
        </div>

        {/* ══ TWO-PANEL BODY ══════════════════════════════════════════ */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left panel ────────────────────────────────────────── */}
          <div className="flex w-67 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-zinc-800 dark:bg-zinc-900/70">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-neutral-800 dark:text-zinc-100">Campaigns</span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 px-1.5 text-[10px] font-bold text-neutral-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {allItems.length}
                </span>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto">
              {filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <p className="text-[12px] text-neutral-400 dark:text-zinc-500">No campaigns found.</p>
                  <Link href="/campaign/new" className="text-[12px] font-medium text-emerald-500 hover:text-emerald-400">
                    Start first campaign →
                  </Link>
                </div>
              )}
              {filteredItems.map(item => {
                const active = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedId(item.id); setLogFilter("all"); setActiveTab("Log"); }}
                    className={`w-full border-b px-4 py-3.5 text-left transition-colors ${
                      active
                        ? "border-neutral-200 bg-white dark:border-zinc-700/50 dark:bg-zinc-800/60"
                        : "border-neutral-200/60 hover:bg-white/70 dark:border-zinc-800/50 dark:hover:bg-zinc-800/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-[13px] font-medium leading-snug ${active ? "text-neutral-900 dark:text-zinc-50" : "text-neutral-600 dark:text-zinc-400"}`}>
                        {item.name}
                      </span>
                      <span className="shrink-0 text-[10px] text-neutral-400 dark:text-zinc-600 mt-0.5">
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <StatusChip status={item.status} />
                      <span className="mono text-[11px] text-neutral-400 dark:text-zinc-500">{item.pct}%</span>
                    </div>
                    <div className="mt-2 h-0.75 rounded-full bg-neutral-100 dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.status === "running"  ? "bg-emerald-500" :
                          item.status === "failed"   ? "bg-rose-400" :
                          item.status === "partial"  ? "bg-amber-400" :
                          "bg-emerald-300 dark:bg-emerald-700"
                        }`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right panel ───────────────────────────────────────── */}
          <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
            {sel ? (
              <>
                {/* Tab bar + actions */}
                <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex gap-0.5">
                    {["Overview", "Log"].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                          activeTab === tab
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "text-neutral-500 hover:bg-white hover:text-neutral-800 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusChip status={sel.status} />
                    <button className="hidden">
                      <span className="text-[16px] leading-none">···</span>
                    </button>
                  </div>
                </div>

                {/* Scrollable detail */}
                <div className="flex-1 space-y-4 overflow-auto bg-neutral-100 px-6 py-5 dark:bg-zinc-950">

                  {/* Campaign title + subtitle */}
                  <div>
                    <h1 className="text-[16px] font-semibold tracking-tight text-neutral-900 dark:text-zinc-50">
                      {activeTab === "Overview" ? "Campaign Overview" : sel.name}
                    </h1>
                    <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-zinc-500">
                      {activeTab === "Overview"
                        ? "All campaign performance across your archive"
                        : sel.preview
                        ? `Message: ${sel.preview}`
                        : timeAgo(sel.createdAt)}
                    </p>
                  </div>

                  {activeTab === "Overview" && (
                    <>
                      {/* Aggregate stat cards — all campaigns */}
                      <div className="grid grid-cols-4 gap-3">
                        <StatCard label="Total Campaigns" value={allItems.length}          color="text-neutral-900 dark:text-zinc-100"    icon={Users}        />
                        <StatCard label="All-time Sent"   value={totalSentAll}             color="text-emerald-500 dark:text-emerald-400" icon={Send}         />
                        <StatCard label="All-time Failed" value={totalFailedAll}           color="text-rose-500 dark:text-rose-400"       icon={XCircle}      />
                        <StatCard label="Success Rate"
                          value={totalSentAll + totalFailedAll > 0
                            ? `${Math.round((totalSentAll / (totalSentAll + totalFailedAll)) * 100)}%`
                            : "—"}
                          color="text-blue-500 dark:text-blue-400"
                          icon={CheckCircle2}
                        />
                      </div>

                      {/* Live progress (only when a campaign is running) */}
                      {isLive && (
                        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-neutral-700 dark:text-zinc-300">Live Campaign Progress</span>
                            <span className="mono text-[13px] font-bold text-neutral-900 dark:text-zinc-100">{livePct}%</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-neutral-100 dark:bg-zinc-800">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${livePct}%` }} />
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-neutral-100 pt-4 text-center dark:border-zinc-800">
                            <div>
                              <p className="mono text-[17px] font-bold text-emerald-500 dark:text-emerald-400">{live.sent?.toLocaleString()}</p>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-zinc-500">Sent</p>
                            </div>
                            <div>
                              <p className="mono text-[17px] font-bold text-neutral-600 dark:text-zinc-300">{Math.max(0, live.total - liveComplete)}</p>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-zinc-500">Pending</p>
                            </div>
                            <div>
                              <p className="mono text-[17px] font-bold text-rose-500 dark:text-rose-400">{live.failed}</p>
                              <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-zinc-500">Failed</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Campaign breakdown list */}
                      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm shadow-neutral-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10">
                        <div className="border-b border-neutral-100 px-5 py-3 dark:border-zinc-800">
                          <span className="text-[13px] font-semibold text-neutral-700 dark:text-zinc-300">All Campaigns</span>
                        </div>
                        <div className="max-h-72 overflow-auto">
                          {allItems.length === 0 && (
                            <p className="p-4 text-center text-[12px] text-neutral-400 dark:text-zinc-500">No campaigns yet.</p>
                          )}
                          {allItems.map(item => (
                            <button
                              key={item.id}
                              onClick={() => { setSelectedId(item.id); setActiveTab("Log"); setLogFilter("all"); }}
                              className="grid w-full grid-cols-[minmax(0,1fr)_90px_90px_104px] items-center gap-3 border-b border-neutral-100 px-5 py-2.5 text-left text-[12px] last:border-0 hover:bg-neutral-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/30"
                            >
                              <span className="truncate font-medium text-neutral-700 dark:text-zinc-300">{item.name}</span>
                              <span className="mono text-emerald-500 dark:text-emerald-400">{item.sent.toLocaleString()} sent</span>
                              <span className="mono text-rose-400 dark:text-rose-400">{item.failed.toLocaleString()} failed</span>
                              <StatusChip status={item.status} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === "Log" && (
                    <>
                      {/* Per-campaign stat cards */}
                      <div className="grid grid-cols-4 gap-3">
                        <StatCard label="Total Recipients" value={sel.total}  color="text-neutral-900 dark:text-zinc-100"      icon={Users}        />
                        <StatCard label="Sent"             value={sel.sent}   color="text-emerald-500 dark:text-emerald-400"   icon={Send}         />
                        <StatCard label="Failed"           value={sel.failed} color="text-rose-500 dark:text-rose-400"         icon={XCircle}      />
                        <StatCard label="Success Rate"
                          value={sel.total > 0 ? `${sel.pct}%` : "—"}
                          color="text-blue-500 dark:text-blue-400"
                          icon={CheckCircle2}
                        />
                      </div>

                      {/* Throughput sparkline */}
                      {!isLive && (
                        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-neutral-700 dark:text-zinc-300">Throughput (12h)</span>
                            <span className="flex items-center gap-1 text-[12px] font-medium text-emerald-500 dark:text-emerald-400">
                              <Zap size={11} /> ~{sel.total > 0 ? Math.round(sel.sent / 12) : 0}/hr
                            </span>
                          </div>
                          <Sparkline values={sparkData.length > 0 ? sparkData : Array(12).fill(0)} />
                          <div className="mt-1.5 flex justify-between">
                            {["12h", "10h", "8h", "6h", "4h", "2h", "Now"].map(l => (
                              <span key={l} className="text-[9px] text-neutral-300 dark:text-zinc-700">{l}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <LogTable
                        rows={filteredLogs}
                        loading={loadingLogs}
                        filter={logFilter}
                        setFilter={setLogFilter}
                        logLabel={logLabel}
                        maxH="max-h-[calc(100vh-420px)]"
                      />
                    </>
                  )}

                  {false && (
                    <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-neutral-200 text-[13px] text-neutral-400 dark:border-zinc-700 dark:text-zinc-600">
                      {activeTab} — coming soon
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-zinc-800">
                  <Play size={22} className="text-neutral-400 dark:text-zinc-500" />
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-neutral-700 dark:text-zinc-300">No campaigns yet</p>
                  <p className="mt-1 text-[13px] text-neutral-400 dark:text-zinc-500">Start your first campaign to see analytics here.</p>
                </div>
                <Link
                  href="/campaign/new"
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-[13px] font-medium text-white shadow-sm shadow-emerald-500/20 transition hover:bg-emerald-400"
                >
                  <Plus size={15} /> New Campaign
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ─── Log table (shared between Overview + Log tabs) ─────────────── */
function LogTable({ rows, loading, filter, setFilter, logLabel, maxH = "max-h-72" }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm shadow-neutral-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-zinc-800">
        <span className="text-[13px] font-semibold text-neutral-700 dark:text-zinc-300">Send Log</span>
        <div className="flex gap-1">
          {["all", "sent", "failed"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${
                filter === f
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-500 hover:bg-neutral-100 dark:text-zinc-500 dark:hover:bg-zinc-800"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className={`${maxH} overflow-auto`}>
        {loading && (
          <p className="p-4 text-center text-[12px] text-neutral-400 dark:text-zinc-500">Loading…</p>
        )}
        {!loading && rows.length === 0 && (
          <p className="p-4 text-center text-[12px] text-neutral-400 dark:text-zinc-500">No entries.</p>
        )}
        {rows.map((entry, i) => {
          const { text, cls } = logLabel(entry.status);
          return (
            <div
              key={i}
              className="grid grid-cols-[28px_1fr_140px_80px] items-center gap-3 border-b border-neutral-50 px-5 py-2.5 text-[12px] last:border-0 dark:border-zinc-800/50"
            >
              <span className="mono text-neutral-300 dark:text-zinc-700">{i + 1}</span>
              <span className="mono truncate text-neutral-500 dark:text-zinc-400">{entry.number}</span>
              <span className={`font-medium ${cls}`}>{text}</span>
              <span className="mono text-right text-[10px] text-neutral-300 dark:text-zinc-700">
                {entry.sent_at ? formatTime(entry.sent_at) : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
