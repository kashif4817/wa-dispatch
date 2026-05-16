import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { startCampaign } from "@/lib/sender";
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

    const form = await request.formData();
    const recipients = JSON.parse(form.get("recipients") || "[]");
    const message = String(form.get("message") || "");
    const options = JSON.parse(form.get("options") || "{}");
    const name = String(form.get("name") || `Campaign ${new Date().toLocaleString()}`);
    const saveAttachmentsToHistory = options.saveAttachmentsToHistory === true;
    const files = [...form.getAll("images"), ...form.getAll("images[]")]
      .filter((file) => file && typeof file.arrayBuffer === "function" && file.size > 0);

    if (!recipients.length) {
      return Response.json({ error: "Add at least one recipient" }, { status: 400 });
    }
    if (!message.trim() && files.length === 0) {
      return Response.json({ error: "Add a message or at least one image" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: campaign, error: insertError } = await supabase
      .from("campaigns")
      .insert({
        name,
        message_text: message,
        total: recipients.length,
        status: "pending",
        options,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const attachments = [];
    const imagePaths = [];

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
        imagePaths.push(path);
      }

      attachments.push({ buffer, type: file.type || "application/octet-stream", name: file.name, path });
    }

    if (imagePaths.length) {
      await supabase.from("campaigns").update({ image_paths: imagePaths }).eq("id", campaign.id);
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
      },
    }).catch(async (error) => {
      await supabase.from("campaigns").update({ status: "error", finished_at: new Date().toISOString() }).eq("id", campaign.id);
      console.error(error);
    });

    return Response.json({ campaignId: campaign.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
