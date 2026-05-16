import { getSocket, getWhatsAppState } from "./whatsapp";
import { getSupabase, hasSupabaseConfig } from "./supabase";
import { normalizeNumber, personalizeMessage } from "./parsers";

function state() {
  if (!globalThis.__waState) globalThis.__waState = {};
  if (!globalThis.__waState.campaign) {
    globalThis.__waState.campaign = {
      id: null,
      total: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      current: null,
      status: "idle",
      log: [],
      cancelRequested: false,
    };
  }
  return globalThis.__waState.campaign;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function appendLog(entry) {
  const campaign = state();
  campaign.log = [{ at: new Date().toISOString(), ...entry }, ...campaign.log].slice(0, 20);
}

async function updateCampaign(id, patch) {
  if (!hasSupabaseConfig()) return;
  const supabase = getSupabase();
  await supabase.from("campaigns").update(patch).eq("id", id);
}

async function insertLog(row) {
  if (!hasSupabaseConfig()) return;
  const supabase = getSupabase();
  await supabase.from("send_logs").insert(row);
}

async function sendAttachments(sock, jid, text, attachments, onAttachmentSent) {
  if (!attachments.length) {
    await sock.sendMessage(jid, { text });
    return;
  }

  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    await sock.sendMessage(jid, buildAttachmentMessage(attachment, index === 0 ? text : ""));
    onAttachmentSent?.(index + 1, attachments.length, attachment);
    if (index < attachments.length - 1) await wait(randomInt(800, 1800));
  }
}

function buildAttachmentMessage(attachment, caption) {
  const buffer = Buffer.isBuffer(attachment.buffer) ? attachment.buffer : Buffer.from(attachment.buffer);
  const mimetype = attachment.type || "application/octet-stream";
  const fileName = attachment.name || "attachment";

  if (mimetype.startsWith("image/")) {
    return { image: buffer, mimetype, caption: caption || undefined };
  }

  if (mimetype.startsWith("video/")) {
    return { video: buffer, mimetype, caption: caption || undefined, fileName };
  }

  return {
    document: buffer,
    mimetype,
    fileName,
    caption: caption || undefined,
  };
}

export function getProgress() {
  return state();
}

export function cancelCampaign() {
  state().cancelRequested = true;
}

export async function startCampaign({ campaignId, recipients, message, images, options }) {
  const campaign = state();
  const sock = getSocket();
  const me = getWhatsAppState().me;

  Object.assign(campaign, {
    id: campaignId,
    total: recipients.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    current: null,
    status: "running",
    log: [],
    cancelRequested: false,
  });

  await updateCampaign(campaignId, { status: "running" });
  appendLog({
    status: "running",
    number: "system",
    message: `Campaign started with ${images.length} attachment(s)`,
  });

  for (let index = 0; index < recipients.length; index += 1) {
    const recipient = recipients[index];
    if (campaign.cancelRequested) {
      campaign.status = "cancelled";
      await updateCampaign(campaignId, { status: "cancelled", finished_at: new Date().toISOString() });
      appendLog({ status: "cancelled", number: recipient.number, message: "Campaign cancelled" });
      return;
    }

    campaign.current = recipient;
    const normalized = normalizeNumber(recipient.number, options.defaultCountryCode);

    try {
      if (!normalized.valid) {
        throw new Error(normalized.error);
      }

      if (me?.number && normalized.digits === me.number) {
        campaign.skipped += 1;
        await insertLog({ campaign_id: campaignId, number: normalized.digits, name: recipient.name, status: "skipped", error: "Self-send prevented" });
        appendLog({ status: "skipped", number: normalized.digits, message: "Self-send prevented" });
      } else {
        const [exists] = await sock.onWhatsApp(normalized.jid);
        if (exists?.exists !== true) {
          campaign.skipped += 1;
          await insertLog({ campaign_id: campaignId, number: normalized.digits, name: recipient.name, status: "skipped", error: "Number not on WhatsApp" });
          appendLog({ status: "skipped", number: normalized.digits, message: "Number not on WhatsApp" });
        } else {
          const text = personalizeMessage(message, recipient);
          await sendAttachments(sock, normalized.jid, text, images, (sentIndex, totalImages, attachment) => {
            appendLog({
              status: "sent",
              number: normalized.digits,
              message: `Attachment ${sentIndex}/${totalImages} sent: ${attachment.name || attachment.type || "file"}`,
            });
          });
          campaign.sent += 1;
          await insertLog({ campaign_id: campaignId, number: normalized.digits, name: recipient.name, status: "sent" });
          appendLog({ status: "sent", number: normalized.digits, message: "Delivered to WhatsApp Web" });
        }
      }
    } catch (error) {
      campaign.failed += 1;
      await insertLog({ campaign_id: campaignId, number: normalized.digits || recipient.number, name: recipient.name, status: "failed", error: error.message });
      appendLog({ status: "failed", number: normalized.digits || recipient.number, message: error.message });
    }

    await updateCampaign(campaignId, {
      sent: campaign.sent,
      failed: campaign.failed,
      skipped: campaign.skipped,
    });

    campaign.current = null;

    if (index < recipients.length - 1) {
      await wait(randomInt(options.minDelayMs, options.maxDelayMs));
    }
  }

  campaign.current = null;
  campaign.status = "done";
  await updateCampaign(campaignId, {
    status: "done",
    sent: campaign.sent,
    failed: campaign.failed,
    skipped: campaign.skipped,
    finished_at: new Date().toISOString(),
  });
}
