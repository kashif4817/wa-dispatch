"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Plus,
  RefreshCw,
  Send,
  SkipForward,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import Shell from "@/components/Shell";
import { PageSkeleton } from "@/components/ui";
import {
  campaignCounts,
  campaignDisplayTitle,
  campaignStatus,
  campaignSubtitle,
  statusLabel,
  statusTone,
} from "@/lib/campaignDisplay";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

function pct(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function statusStyles(status) {
  const tone = statusTone(status);
  return {
    emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    rose: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
    sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    neutral: "bg-neutral-100 text-neutral-500 dark:bg-zinc-800 dark:text-zinc-400",
  }[tone];
}

function MetricCard({ label, value, detail, icon: Icon, tone = "neutral" }) {
  const tones = {
    emerald: "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10",
    rose: "text-rose-500 dark:text-rose-400 bg-rose-500/10",
    amber: "text-amber-500 dark:text-amber-400 bg-amber-500/10",
    sky: "text-sky-500 dark:text-sky-400 bg-sky-500/10",
    neutral: "text-neutral-600 dark:text-zinc-300 bg-neutral-100 dark:bg-zinc-800",
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">{label}</p>
          <p className="mono mt-2 text-[25px] font-semibold leading-none text-neutral-900 dark:text-zinc-50">{value}</p>
        </div>
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon size={17} />
        </div>
      </div>
      {detail && <p className="mt-3 text-[12px] leading-5 text-neutral-500 dark:text-zinc-500">{detail}</p>}
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyles(status)}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}

function MiniBar({ label, value, total, tone }) {
  const colors = {
    emerald: "bg-emerald-500",
    rose: "bg-rose-400",
    amber: "bg-amber-400",
    sky: "bg-sky-400",
  };
  const width = pct(value, total);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
        <span className="text-neutral-500 dark:text-zinc-500">{label}</span>
        <span className="mono font-medium text-neutral-700 dark:text-zinc-300">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-neutral-100 dark:bg-zinc-800">
        <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ActivityBars({ values }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-36 items-end gap-2">
      {values.map((value, index) => (
        <div key={index} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-28 w-full items-end rounded-lg bg-neutral-100 dark:bg-zinc-800">
            <div
              className="w-full rounded-lg bg-emerald-500/70"
              style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-neutral-300 dark:text-zinc-700">{index + 1}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState([]);
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem("wa_sender_unlocked") !== "true") router.replace("/");
  }, [router]);

  async function loadCampaigns() {
    if (!hasSupabaseConfig()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await getSupabase()
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);
      setCampaigns(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCampaigns(); }, []);

  useEffect(() => {
    async function poll() {
      try {
        const data = await fetch("/api/progress").then((response) => response.json());
        setLive(data?.total > 0 && ["running", "retrying", "paused"].includes(data.status) ? data : null);
      } catch {
        setLive(null);
      }
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  const campaignItems = useMemo(() => campaigns.map((campaign, index) => ({
    ...campaign,
    displayTitle: campaignDisplayTitle(campaign, campaigns.length - index - 1),
    subtitle: campaignSubtitle(campaign),
    status: campaignStatus(campaign),
    counts: campaignCounts(campaign),
  })), [campaigns]);

  const totals = useMemo(() => campaignItems.reduce((acc, campaign) => {
    acc.sent += campaign.counts.sent;
    acc.failed += campaign.counts.failed;
    acc.skipped += campaign.counts.skipped;
    acc.total += campaign.counts.total;
    acc.completed += campaign.counts.completed;
    acc.remaining += campaign.counts.remaining;
    acc.partial += campaign.status === "partial" ? 1 : 0;
    acc.failedCampaigns += campaign.status === "failed" ? 1 : 0;
    acc.completedCampaigns += campaign.status === "completed" ? 1 : 0;
    return acc;
  }, {
    sent: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    completed: 0,
    remaining: 0,
    partial: 0,
    failedCampaigns: 0,
    completedCampaigns: 0,
  }), [campaignItems]);

  const liveCounts = live ? campaignCounts(live) : null;
  const totalOutcome = totals.sent + totals.failed + totals.skipped;
  const successRate = pct(totals.sent, totalOutcome);
  const issueRate = pct(totals.failed + totals.skipped, totalOutcome);
  const avgRecipients = campaignItems.length ? Math.round(totals.total / campaignItems.length) : 0;

  const recent = campaignItems.slice(0, 5);
  const activity = useMemo(() => {
    const buckets = Array(7).fill(0);
    for (const campaign of campaignItems) {
      if (!campaign.created_at) continue;
      const ageDays = Math.floor((Date.now() - new Date(campaign.created_at).getTime()) / 86400000);
      if (ageDays >= 0 && ageDays < 7) buckets[6 - ageDays] += campaign.counts.completed;
    }
    return buckets;
  }, [campaignItems]);

  return (
    <Shell noPadding>
      {loading ? <PageSkeleton title="Loading dashboard" /> : (
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 text-neutral-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-1 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">Dashboard</span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
          <Link href="/campaign/new" className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-emerald-500/25 transition hover:bg-emerald-400">
            <Plus size={14} /> New Campaign
          </Link>
          <Link href="/campaigns" className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700">
            <FolderKanban size={13} /> Campaigns
          </Link>
          <button onClick={loadCampaigns} className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700">
            <RefreshCw size={13} /> Refresh
          </button>
          <div className="ml-auto flex items-center gap-3 text-[12px]">
            <span className="text-neutral-400 dark:text-zinc-600">Success</span>
            <span className="mono font-semibold text-emerald-600 dark:text-emerald-400">{successRate}%</span>
            <span className="text-neutral-300 dark:text-zinc-700">/</span>
            <span className="text-neutral-400 dark:text-zinc-600">Issues</span>
            <span className="mono font-semibold text-amber-600 dark:text-amber-400">{issueRate}%</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="grid gap-4 xl:grid-cols-4">
            <MetricCard label="Total Campaigns" value={campaignItems.length.toLocaleString()} detail={`${totals.completedCampaigns} completed, ${totals.partial} partial`} icon={FolderKanban} tone="neutral" />
            <MetricCard label="Messages Sent" value={totals.sent.toLocaleString()} detail={`${successRate}% of completed outcomes`} icon={Send} tone="emerald" />
            <MetricCard label="Failed" value={totals.failed.toLocaleString()} detail={`${totals.failedCampaigns} campaigns need attention`} icon={XCircle} tone="rose" />
            <MetricCard label="Skipped" value={totals.skipped.toLocaleString()} detail="Self-send and unavailable number protection" icon={SkipForward} tone="amber" />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm shadow-neutral-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">Advanced Analytics</p>
                  <h2 className="mt-1 text-[16px] font-semibold text-neutral-900 dark:text-zinc-50">Delivery Health</h2>
                </div>
                <BarChart3 size={18} className="text-neutral-300 dark:text-zinc-600" />
              </div>
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                <div className="space-y-4">
                  <MiniBar label="Sent" value={totals.sent} total={totalOutcome} tone="emerald" />
                  <MiniBar label="Failed" value={totals.failed} total={totalOutcome} tone="rose" />
                  <MiniBar label="Skipped" value={totals.skipped} total={totalOutcome} tone="amber" />
                  <MiniBar label="Remaining" value={totals.remaining} total={totals.total} tone="sky" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="Avg Recipients" value={avgRecipients.toLocaleString()} detail="Per campaign" icon={Users} tone="sky" />
                  <MetricCard label="Partial" value={totals.partial.toLocaleString()} detail="Sent with issues" icon={Activity} tone="amber" />
                  <MetricCard label="Total Queue" value={totals.total.toLocaleString()} detail="All recipients tracked" icon={Clock3} tone="neutral" />
                  <MetricCard label="Outcome Rate" value={`${pct(totalOutcome, totals.total)}%`} detail="Completed from planned" icon={TrendingUp} tone="emerald" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm shadow-neutral-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">Last 7 Days</p>
                  <h2 className="mt-1 text-[16px] font-semibold text-neutral-900 dark:text-zinc-50">Send Activity</h2>
                </div>
                <Activity size={18} className="text-emerald-500 dark:text-emerald-400" />
              </div>
              <ActivityBars values={activity} />
            </div>
          </div>

          {live && liveCounts && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm shadow-emerald-200/40 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:shadow-black/10">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/70 dark:text-emerald-300/70">Live Campaign</p>
                  <h2 className="mt-1 text-[16px] font-semibold text-emerald-950 dark:text-emerald-100">Active delivery running</h2>
                </div>
                <span className="mono text-[13px] font-bold text-emerald-700 dark:text-emerald-300">{liveCounts.pct}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/80 dark:bg-zinc-900/70">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${liveCounts.pct}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-4 gap-3 text-center">
                <LiveMini label="Sent" value={liveCounts.sent} />
                <LiveMini label="Failed" value={liveCounts.failed} />
                <LiveMini label="Skipped" value={liveCounts.skipped} />
                <LiveMini label="Remaining" value={liveCounts.remaining} />
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-neutral-200 bg-white shadow-sm shadow-neutral-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/10">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-zinc-800">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">Overview</p>
                <h2 className="mt-1 text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">Recent Campaigns</h2>
              </div>
              <Link href="/campaigns" className="text-[12px] font-medium text-emerald-500 hover:text-emerald-400">View all</Link>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-zinc-800/70">
              {recent.length === 0 && <p className="p-5 text-center text-[13px] text-neutral-400 dark:text-zinc-500">No campaigns yet.</p>}
              {recent.map((campaign) => (
                <Link key={campaign.id} href="/campaigns" className="grid grid-cols-[minmax(0,1fr)_90px_90px_90px_104px] items-center gap-4 px-5 py-3 text-[12px] transition hover:bg-neutral-50/80 dark:hover:bg-zinc-800/40">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-neutral-900 dark:text-zinc-100">{campaign.displayTitle}</p>
                    <p className="mt-1 truncate text-[11px] text-neutral-400 dark:text-zinc-500">{campaign.subtitle}</p>
                  </div>
                  <span className="mono text-emerald-500 dark:text-emerald-400">{campaign.counts.sent.toLocaleString()} sent</span>
                  <span className="mono text-rose-500 dark:text-rose-400">{campaign.counts.failed.toLocaleString()} failed</span>
                  <span className="mono text-amber-500 dark:text-amber-400">{campaign.counts.skipped.toLocaleString()} skipped</span>
                  <StatusPill status={campaign.status} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </Shell>
  );
}

function LiveMini({ label, value }) {
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-zinc-900/60">
      <p className="mono text-[17px] font-bold text-emerald-700 dark:text-emerald-300">{Number(value || 0).toLocaleString()}</p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700/60 dark:text-emerald-300/60">{label}</p>
    </div>
  );
}
