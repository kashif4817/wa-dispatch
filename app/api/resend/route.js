import { campaignName } from "@/lib/dateFormat";
import { startCampaign } from "@/lib/sender";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { ensureConnected, getSocket } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const connected = await ensureConnected(20000);
    if (!connected || !getSocket()) {
      return Response.json({ error: "WhatsApp session is not ready yet. Click Refresh, wait a few seconds, then try again." }, { status: 409 });
    }

    if (!hasSupabaseConfig()) {
      return Response.json({ error: "Missing Supabase configuration" }, { status: 400 });
    }

    const body = await request.json();
    const campaignId = String(body.campaignId || "");
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (!campaignId) return Response.json({ error: "Missing campaign id" }, { status: 400 });
    if (!rows.length) return Response.json({ error: "Select at least one failed or skipped log to retry" }, { status: 400 });

    const supabase = getSupabase();
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) throw campaignError || new Error("Campaign not found");

    const retryLogIds = rows.map((row) => row.id).filter(Boolean);
    const { data: logs, error: logsError } = await supabase
      .from("send_logs")
      .select("id,status,campaign_id")
      .eq("campaign_id", campaignId)
      .in("id", retryLogIds);

    if (logsError) throw logsError;
    const allowed = new Set((logs || [])
      .filter((log) => log.status === "failed" || log.status === "skipped")
      .map((log) => log.id));

    const retryRows = rows.filter((row) => allowed.has(row.id));
    if (!retryRows.length) return Response.json({ error: "Only failed or skipped logs can be retried" }, { status: 400 });

    const recipients = retryRows
      .map((row) => ({ number: String(row.number || "").trim(), name: String(row.name || "").trim() }))
      .filter((row) => row.number);

    if (!recipients.length) return Response.json({ error: "Add at least one number to retry" }, { status: 400 });

    const attachments = [];
    for (const path of campaign.image_paths || []) {
      const { data: blob, error: downloadError } = await supabase.storage
        .from("campaign-images")
        .download(path);
      if (downloadError) throw downloadError;
      attachments.push({
        buffer: Buffer.from(await blob.arrayBuffer()),
        type: blob.type || "application/octet-stream",
        name: String(path).split("/").pop() || "attachment",
        path,
      });
    }

    startCampaign({
      campaignId,
      recipients,
      message: campaign.message_text || "",
      images: attachments,
      retryLogIds: retryRows.map((row) => row.id),
      options: {
        minDelayMs: Math.max(1000, Number(campaign.options?.minDelayMs || campaign.options?.minDelaySeconds * 1000 || 8000)),
        maxDelayMs: Math.max(
          Number(campaign.options?.maxDelayMs || campaign.options?.maxDelaySeconds * 1000 || 25000),
          Number(campaign.options?.minDelayMs || campaign.options?.minDelaySeconds * 1000 || 8000)
        ),
        defaultCountryCode: campaign.options?.defaultCountryCode || "",
      },
    }).catch(async (error) => {
      await supabase.from("campaigns").update({ status: "error", finished_at: new Date().toISOString() }).eq("id", campaignId);
      console.error(error);
    });

    return Response.json({
      campaignId,
      retried: recipients.length,
      attachmentCount: attachments.length,
      name: campaign.name || campaignName(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
