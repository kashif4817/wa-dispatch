"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Nav from "@/components/Nav";
import { FileText } from "lucide-react";
import { getPublicUrl, getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { Button } from "@/components/ui";

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
    const rows = logs.map((log) => [log.number, log.name, log.status, log.error, log.sent_at].map((value) => `"${String(value || "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `campaign-${id}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Nav />
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5">
        <section className="control-card rounded-lg p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mono text-[11px] uppercase tracking-wider text-zinc-500">Campaign detail</p>
              <h1 className="text-xl font-black">{campaign?.name || id}</h1>
            </div>
            <Button variant="neutral" onClick={exportCsv}>Export CSV</Button>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-zinc-300">{campaign?.message_text}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-6">
            {(campaign?.image_paths || []).map((path) => <AttachmentLink key={path} path={path} />)}
          </div>
        </section>

        <section className="control-card rounded-lg overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
              <tr><th className="p-3">Number</th><th>Name</th><th>Status</th><th>Reason</th><th>Sent at</th></tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-zinc-900">
                  <td className="p-3 mono">{log.number}</td>
                  <td className="p-3">{log.name}</td>
                  <td className="p-3 mono">{log.status}</td>
                  <td className="p-3 text-rose-300">{log.error}</td>
                  <td className="p-3 mono text-zinc-500">{new Date(log.sent_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}

function AttachmentLink({ path }) {
  const url = getPublicUrl("campaign-images", path);
  const name = path.split("/").pop();
  const isImage = /\.(png|jpe?g|webp|gif)$/i.test(name);

  if (isImage) {
    return <img src={url} alt="" className="aspect-square border border-zinc-800 object-cover" />;
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex aspect-square flex-col items-center justify-center border border-zinc-800 bg-zinc-950 p-3 text-center hover:border-emerald-500/50">
      <FileText className="mb-2 text-emerald-300" size={28} />
      <span className="line-clamp-3 break-all text-xs font-bold text-zinc-200">{name}</span>
    </a>
  );
}
