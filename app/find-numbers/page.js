"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Zap } from "lucide-react";
import Shell from "@/components/Shell";
import { Button, CardListSkeleton } from "@/components/ui";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

const statusStyles = {
  unused: "bg-neutral-100 text-neutral-500 dark:bg-zinc-800 dark:text-zinc-400",
  used: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  sent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  failed: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  skipped: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  partial: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
};

const statusLabels = {
  unused: "Unused",
  used: "Used",
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
  partial: "Partial",
};

function recipientKey(number) {
  return String(number || "").replace(/\D/g, "");
}

function StatusChip({ status = "unused", title = "" }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyles[status] || statusStyles.unused}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status] || "Unused"}
    </span>
  );
}

function buildUsageIndex(logs) {
  const map = new Map();
  for (const log of logs || []) {
    const key = recipientKey(log.number);
    if (!key) continue;
    const current = map.get(key) || {
      sent: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      lastAt: "",
      lastStatus: "unused",
      campaignName: "",
      error: "",
    };
    current.total += 1;
    if (log.status === "sent") current.sent += 1;
    if (log.status === "failed") current.failed += 1;
    if (log.status === "skipped") current.skipped += 1;
    if (!current.lastAt || new Date(log.sent_at) > new Date(current.lastAt)) {
      current.lastAt = log.sent_at;
      current.lastStatus = log.status || "used";
      current.campaignName = log.campaigns?.name || log.campaign_id || "";
      current.error = log.error || "";
    }
    current.status = current.sent > 0 && (current.failed > 0 || current.skipped > 0)
      ? "partial"
      : current.sent > 0
        ? "sent"
        : current.failed > 0
          ? "failed"
          : current.skipped > 0
            ? "skipped"
            : "used";
    map.set(key, current);
  }
  return map;
}

function campaignStatusFor(recipient, usageIndex) {
  return usageIndex.get(recipientKey(recipient.number)) || { status: "unused", total: 0 };
}

function manualStatusFor(recipient) {
  return recipient.localStatus || recipient.status || "unused";
}

export default function FindNumbersPage() {
  const [lists, setLists] = useState([]);
  const [logs, setLogs] = useState([]);
  const [numberSearch, setNumberSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const usageIndex = useMemo(() => buildUsageIndex(logs), [logs]);

  async function load() {
    if (!hasSupabaseConfig()) {
      setLoading(false);
      return;
    }
    try {
      const supabase = getSupabase();
      const [{ data: listData }, { data: logData }] = await Promise.all([
        supabase.from("recipient_lists").select("*").order("created_at", { ascending: false }),
        supabase
          .from("send_logs")
          .select("number,name,status,error,sent_at,campaign_id,campaigns(name)")
          .order("sent_at", { ascending: false })
          .limit(5000),
      ]);
      setLists(listData || []);
      setLogs(logData || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const allNumbers = useMemo(() => lists.flatMap((list) =>
    (list.recipients || []).map((recipient, index) => ({
      list,
      recipient,
      index,
      campaignUsage: campaignStatusFor(recipient, usageIndex),
      manualStatus: manualStatusFor(recipient),
    }))
  ), [lists, usageIndex]);

  const filteredNumbers = useMemo(() => {
    const query = numberSearch.trim().toLowerCase();
    if (!query) return allNumbers.slice(0, 100);
    return allNumbers.filter(({ list, recipient, campaignUsage, manualStatus }) =>
      recipientKey(recipient.number).includes(recipientKey(query)) ||
      String(recipient.number || "").toLowerCase().includes(query) ||
      String(recipient.name || "").toLowerCase().includes(query) ||
      String(list.name || "").toLowerCase().includes(query) ||
      campaignUsage.status.includes(query) ||
      manualStatus.includes(query)
    ).slice(0, 200);
  }, [allNumbers, numberSearch]);

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-blue-500 dark:border-zinc-700 dark:bg-zinc-800">
            <Search size={18} />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold text-neutral-900 dark:text-zinc-50">Find Numbers</h1>
            <p className="text-[12px] text-neutral-500 dark:text-zinc-400">Search across all your contact lists</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="border-b border-neutral-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex h-10 items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 dark:border-zinc-700 dark:bg-zinc-800">
            <Search size={16} className="shrink-0 text-neutral-400" />
            <input
              value={numberSearch}
              onChange={(e) => setNumberSearch(e.target.value)}
              placeholder="Search number, name, list, or status..."
              className="w-full bg-transparent text-[13px] text-neutral-700 placeholder-neutral-400 outline-none dark:text-zinc-200 dark:placeholder-zinc-500"
              autoFocus
            />
            {numberSearch && (
              <button
                onClick={() => setNumberSearch("")}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-300"
              >
                <Zap size={16} />
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-neutral-500 dark:text-zinc-400">
            Found <span className="font-semibold text-neutral-700 dark:text-zinc-300">{filteredNumbers.length}</span> numbers
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-6">
              <CardListSkeleton count={5} />
            </div>
          ) : filteredNumbers.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-center">
              <div>
                <p className="text-[13px] text-neutral-400 dark:text-zinc-500">
                  {numberSearch ? "No numbers match your search" : "Start typing to search"}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-zinc-800">
              {filteredNumbers.map(({ list, recipient, index, campaignUsage, manualStatus }) => (
                <div
                  key={`${list.id}-${recipient.number}-${index}`}
                  className="grid grid-cols-[1fr_auto] gap-4 border-b border-neutral-200 bg-white px-6 py-4 hover:bg-neutral-50 transition dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <p className="truncate font-semibold text-neutral-900 dark:text-zinc-50">{recipient.name || "No name"}</p>
                      <span className="mono text-[11px] text-neutral-500 dark:text-zinc-400 shrink-0">{recipient.number}</span>
                    </div>
                    <p className="text-[12px] text-neutral-500 dark:text-zinc-400">From: <span className="font-medium text-neutral-700 dark:text-zinc-300">{list.name}</span></p>
                    {campaignUsage.campaignName && (
                      <p className="text-[11px] text-neutral-400 dark:text-zinc-500 mt-1">Last: {campaignUsage.campaignName}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex gap-1.5">
                      <StatusChip status={campaignUsage.status} title={campaignUsage.error || campaignUsage.campaignName || ""} />
                      {manualStatus !== "unused" && <StatusChip status={manualStatus} title="Manual mark" />}
                    </div>
                    <span className="text-[10px] text-neutral-400 dark:text-zinc-500">{campaignUsage.total || 0} attempts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
