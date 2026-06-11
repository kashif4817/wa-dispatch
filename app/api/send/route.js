import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { startCampaign } from "@/lib/sender";
import { ensureConnected, getSocket } from "@/lib/whatsapp";
import { campaignName } from "@/lib/dateFormat";

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

    const form = await request.formData();
    const recipients = JSON.parse(form.get("recipients") || "[]");
    const message = String(form.get("message") || "");
    const options = JSON.parse(form.get("options") || "{}");
    const name = String(form.get("name") || campaignName());
    const imagePaths = JSON.parse(form.get("imagePaths") || "[]");
    const saveAttachmentsToHistory = options.saveAttachmentsToHistory !== false;
    const files = [...form.getAll("images"), ...form.getAll("images[]")]
      .filter((file) => file && typeof file.arrayBuffer === "function" && file.size > 0);

    if (!recipients.length) {
      return Response.json({ error: "Add at least one recipient" }, { status: 400 });
    }
    if (!message.trim() && files.length === 0 && imagePaths.length === 0) {
      return Response.json({ error: "Add a message or at least one image" }, { status: 400 });
    }
    if (options.consentConfirmed === false) {
      return Response.json({ error: "Confirm expected-contact consent before launching" }, { status: 400 });
    }

    const perCampaignCap = Math.max(1, Number(options.perCampaignCap || 500));
    if (recipients.length > perCampaignCap) {
      return Response.json({ error: `Campaign has ${recipients.length} recipients, above the cap of ${perCampaignCap}` }, { status: 400 });
    }

    const supabase = getSupabase();
    const dailySendCap = Math.max(1, Number(options.dailySendCap || 250));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: sentToday, error: countError } = await supabase
      .from("send_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", today.toISOString());
    if (countError) throw countError;
    if (Number(sentToday || 0) + recipients.length > dailySendCap) {
      return Response.json({
        error: `Daily cap would be exceeded. Sent today: ${sentToday || 0}, cap: ${dailySendCap}`,
      }, { status: 400 });
    }

    const campaignOptions = {
      ...options,
      recipientsSnapshot: recipients,
      attachmentCount: files.length + imagePaths.length,
    };
    const { data: campaign, error: insertError } = await supabase
      .from("campaigns")
      .insert({
        name,
        message_text: message,
        total: recipients.length,
        status: "pending",
        options: campaignOptions,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const attachments = [];
    const savedImagePaths = [];

    for (const path of imagePaths) {
      const { data: blob, error: downloadError } = await supabase.storage
        .from("campaign-images")
        .download(path);
      if (downloadError) throw downloadError;
      const name = String(path).split("/").pop() || "attachment";
      attachments.push({
        buffer: Buffer.from(await blob.arrayBuffer()),
        type: blob.type || "application/octet-stream",
        name,
        path,
      });
      savedImagePaths.push(path);
    }

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      let path = null;

      if (saveAttachmentsToHistory) {
        const safeName = file.name.replace(/[^\w.-]/g, "_");
        path = `${campaign.id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("campaign-images")
          .upload(path, buffer, { contentType: file.type, upsert: false });

        if (uploadError) throw uploadError;
        savedImagePaths.push(path);
      }

      attachments.push({ buffer, type: file.type || "application/octet-stream", name: file.name, path });
    }

    if (savedImagePaths.length) {
      await supabase.from("campaigns").update({ image_paths: savedImagePaths }).eq("id", campaign.id);
    }

    startCampaign({
      campaignId: campaign.id,
      recipients,
      message,
      images: attachments,
      options: {
        minDelayMs: Math.max(1000, Number(options.minDelayMs || 8000)),
        maxDelayMs: Math.max(Number(options.maxDelayMs || 25000), Number(options.minDelayMs || 8000)),
        defaultCountryCode: options.defaultCountryCode || "",
        scheduledFor: options.scheduledFor || null,
        quietHoursEnabled: options.quietHoursEnabled === true,
        quietHoursStart: options.quietHoursStart || "21:00",
        quietHoursEnd: options.quietHoursEnd || "09:00",
        dailySendCap,
        perCampaignCap,
        cooldownHours: Math.max(0, Number(options.cooldownHours || 0)),
        warmupMode: options.warmupMode === true,
        adaptiveDelayEnabled: options.adaptiveDelayEnabled !== false,
      },
    }).catch(async (error) => {
      await supabase.from("campaigns").update({ status: "error", finished_at: new Date().toISOString() }).eq("id", campaign.id);
      console.error(error);
    });

    return Response.json({ campaignId: campaign.id, queued: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
