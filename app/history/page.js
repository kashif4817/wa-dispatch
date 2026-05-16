"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

export default function HistoryPage() {
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    async function load() {
      if (!hasSupabaseConfig()) return;
      const supabase = getSupabase();
      const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      const ids = (data || []).map((campaign) => campaign.id);

      if (!ids.length) {
        setCampaigns([]);
        return;
      }

      const { data: failedLogs } = await supabase
        .from("send_logs")
        .select("campaign_id,error,sent_at")
        .in("campaign_id", ids)
        .eq("status", "failed")
        .order("sent_at", { ascending: false });

      const reasons = new Map();
      for (const log of failedLogs || []) {
        if (!reasons.has(log.campaign_id)) {
          reasons.set(log.campaign_id, log.error || "Failed without a reason");
        }
      }

      setCampaigns((data || []).map((campaign) => ({
        ...campaign,
        failureReason: reasons.get(campaign.id) || "",
      })));
    }
    load();
  }, []);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-5">
        <section className="control-card rounded-lg">
          <div className="border-b border-zinc-800 px-5 py-4">
            <p className="mono text-[11px] uppercase tracking-wider text-zinc-500">Campaign archive</p>
            <h1 className="text-xl font-black">History</h1>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Sent</th>
                  <th className="p-3">Failed</th>
                  <th className="p-3">Failure reason</th>
                  <th className="p-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-zinc-900 hover:bg-zinc-900/60">
                    <td className="p-3 font-bold"><Link href={`/history/${campaign.id}`}>{campaign.name || campaign.id}</Link></td>
                    <td className="p-3 mono text-emerald-300">{campaign.sent}</td>
                    <td className="p-3 mono text-rose-300">{campaign.failed}</td>
                    <td className="max-w-md truncate p-3 text-rose-200">{campaign.failureReason || "-"}</td>
                    <td className="p-3 mono text-zinc-500">{new Date(campaign.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
