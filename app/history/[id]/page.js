"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FileText, History, Plus } from "lucide-react";
import Shell from "@/components/Shell";
import { Button, Section } from "@/components/ui";
import { formatDateTime, normalizeDateText } from "@/lib/dateFormat";
import { getPublicUrl, getSupabase, hasSupabaseConfig } from "@/lib/supabase";

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    async function load() {
      if (!hasSupabaseConfig()) return;
      const supabase = getSupabase();
      const { data: campaignData } = await supabase.from("campaigns").select("*").eq("id", id).single();
      const { data: logData } = await supabase.from("send_logs").select("*").eq("campaign_id", id).order("sent_at", { ascending: false });
      setCampaign(campaignData);
      setLogs(logData || []);
    }
    load();
  }, [id]);

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

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-1 truncate text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">
            {normalizeDateText(campaign?.name || "Campaign detail")}
          </span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
          <Link
            href="/history"
            className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700"
          >
            <History size={13} /> History
          </Link>
          <Link
            href="/campaign/new"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-emerald-500/25 transition hover:bg-emerald-400"
          >
            <Plus size={14} /> New Campaign
          </Link>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="flex flex-col gap-5">

        {/* Campaign overview card */}
        <Section
          title="Overview"
          eyebrow="Campaign info"
          aside={<Button variant="neutral" size="sm" onClick={exportCsv}>Export CSV</Button>}
        >
          {campaign?.message_text && (
            <p className="mb-4 whitespace-pre-wrap text-[14px] leading-7 text-neutral-600 dark:text-zinc-300">
              {campaign.message_text}
            </p>
          )}
          {(campaign?.image_paths || []).length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {campaign.image_paths.map((path) => <AttachmentLink key={path} path={path} />)}
            </div>
          )}
        </Section>

        {/* Send logs table */}
        <Section title="Send Log" eyebrow={`${logs.length} entries`}>
          <div className="overflow-auto rounded-xl">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-zinc-800">
                  {["Number", "Name", "Status", "Reason", "Sent at"].map((h) => (
                    <th key={h} className="p-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-neutral-50 hover:bg-neutral-50/80 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40">
                    <td className="p-3 mono text-neutral-700 dark:text-zinc-300">{log.number}</td>
                    <td className="p-3 text-neutral-600 dark:text-zinc-400">{log.name}</td>
                    <td className={`p-3 mono font-medium ${
                      log.status === "sent" ? "text-emerald-500 dark:text-emerald-400" :
                      log.status === "failed" ? "text-rose-500 dark:text-rose-400" :
                      "text-amber-500 dark:text-amber-400"
                    }`}>{log.status}</td>
                    <td className="p-3 text-rose-500 dark:text-rose-400">{log.error || "—"}</td>
                    <td className="p-3 mono text-neutral-400 dark:text-zinc-500">{formatDateTime(log.sent_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
          </div>
        </div>
      </div>
    </Shell>
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
