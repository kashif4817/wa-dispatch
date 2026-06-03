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
      pauseRequested: false,
    };
  }
  return globalThis.__waState.campaign;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function waitWhilePaused(campaignId) {
  const campaign = state();
  if (!campaign.pauseRequested) return;

  campaign.status = "paused";
  await updateCampaign(campaignId, { status: "paused" });
  appendLog({ status: "paused", number: "system", message: "Campaign paused" });

  while (campaign.pauseRequested && !campaign.cancelRequested) {
    await wait(500);
  }

  if (!campaign.cancelRequested) {
    campaign.status = "running";
    await updateCampaign(campaignId, { status: "running" });
    appendLog({ status: "running", number: "system", message: "Campaign resumed" });
  }
}

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

async function updateLog(id, patch) {
  if (!hasSupabaseConfig() || !id) return;
  const supabase = getSupabase();
  await supabase.from("send_logs").update({ ...patch, sent_at: new Date().toISOString() }).eq("id", id);
}

async function updateCampaignCounts(id, status = null) {
  if (!hasSupabaseConfig()) return;
  const supabase = getSupabase();
  const { data } = await supabase.from("send_logs").select("status").eq("campaign_id", id);
  const counts = (data || []).reduce((acc, row) => {
    if (row.status === "sent") acc.sent += 1;
    if (row.status === "failed") acc.failed += 1;
    if (row.status === "skipped") acc.skipped += 1;
    return acc;
  }, { sent: 0, failed: 0, skipped: 0 });
  const totalDone = counts.sent + counts.failed + counts.skipped;
  const patch = { ...counts };
  if (status === "finished") {
    patch.status = counts.failed > 0 || counts.skipped > 0
      ? counts.sent > 0 ? "partial" : "failed"
      : "done";
    patch.finished_at = new Date().toISOString();
  } else if (status) {
    patch.status = counts.failed > 0 || counts.skipped > 0 ? "partial" : "done";
    if (["done", "cancelled", "error"].includes(status)) patch.finished_at = new Date().toISOString();
  } else if (totalDone > 0) {
    patch.status = "retrying";
  }
  await updateCampaign(id, patch);
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

export function pauseCampaign() {
  const campaign = state();
  if (campaign.status === "running") campaign.pauseRequested = true;
}

export function resumeCampaign() {
  const campaign = state();
  campaign.pauseRequested = false;
}

export async function startCampaign({ campaignId, recipients, message, images, options, retryLogIds = [] }) {
  const campaign = state();
  const sock = getSocket();
  const me = getWhatsAppState().me;
  const retrying = retryLogIds.length > 0;

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
    pauseRequested: false,
  });

  await updateCampaign(campaignId, { status: retrying ? "retrying" : "running" });
  appendLog({
    status: retrying ? "retrying" : "running",
    number: "system",
    message: `${retrying ? "Retry" : "Campaign"} started with ${images.length} attachment(s)`,
  });

  for (let index = 0; index < recipients.length; index += 1) {
    const recipient = recipients[index];
    const retryLogId = retryLogIds[index];
    await waitWhilePaused(campaignId);

    if (campaign.cancelRequested) {
      campaign.status = "cancelled";
      await updateCampaign(campaignId, { status: "cancelled", finished_at: new Date().toISOString() });
      appendLog({ status: "cancelled", number: recipient.number, message: "Campaign cancelled" });
      return;
    }

    campaign.current = recipient;
    const normalized = normalizeNumber(recipient.number, options.defaultCountryCode);

    try {
      if (retryLogId) {
        await updateLog(retryLogId, {
          number: recipient.number,
          name: recipient.name,
          status: "retrying",
          error: `Retry started with ${images.length} attachment(s)`,
        });
      }

      if (!normalized.valid) {
        throw new Error(normalized.error);
      }

      if (me?.number && normalized.digits === me.number) {
        campaign.skipped += 1;
        if (retryLogId) {
          await updateLog(retryLogId, { number: normalized.digits, name: recipient.name, status: "skipped", error: "Self-send prevented" });
        } else {
          await insertLog({ campaign_id: campaignId, number: normalized.digits, name: recipient.name, status: "skipped", error: "Self-send prevented" });
        }
        appendLog({ status: "skipped", number: normalized.digits, message: "Self-send prevented" });
      } else {
        const [exists] = await sock.onWhatsApp(normalized.jid);
        if (exists?.exists !== true) {
          campaign.skipped += 1;
          if (retryLogId) {
            await updateLog(retryLogId, { number: normalized.digits, name: recipient.name, status: "skipped", error: "Number not on WhatsApp" });
          } else {
            await insertLog({ campaign_id: campaignId, number: normalized.digits, name: recipient.name, status: "skipped", error: "Number not on WhatsApp" });
          }
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
          if (retryLogId) {
            await updateLog(retryLogId, { number: normalized.digits, name: recipient.name, status: "sent", error: null });
          } else {
            await insertLog({ campaign_id: campaignId, number: normalized.digits, name: recipient.name, status: "sent" });
          }
          appendLog({ status: "sent", number: normalized.digits, message: retrying ? "Retry sent successfully" : "Delivered to WhatsApp Web" });
        }
      }
    } catch (error) {
      campaign.failed += 1;
      if (retryLogId) {
        await updateLog(retryLogId, { number: normalized.digits || recipient.number, name: recipient.name, status: "failed", error: error.message });
      } else {
        await insertLog({ campaign_id: campaignId, number: normalized.digits || recipient.number, name: recipient.name, status: "failed", error: error.message });
      }
      appendLog({ status: "failed", number: normalized.digits || recipient.number, message: retrying ? `Retry failed: ${error.message}` : error.message });
    }

    if (retrying) await updateCampaignCounts(campaignId);
    else {
      await updateCampaign(campaignId, {
        sent: campaign.sent,
        failed: campaign.failed,
        skipped: campaign.skipped,
      });
    }

    campaign.current = null;

    if (index < recipients.length - 1) {
      const delayUntil = Date.now() + randomInt(options.minDelayMs, options.maxDelayMs);
      while (Date.now() < delayUntil) {
        if (campaign.cancelRequested || campaign.pauseRequested) break;
        await wait(Math.min(500, delayUntil - Date.now()));
      }
    }
  }

  campaign.current = null;
  campaign.status = "done";
  if (retrying) await updateCampaignCounts(campaignId, "finished");
  else {
    await updateCampaign(campaignId, {
      status: "done",
      sent: campaign.sent,
      failed: campaign.failed,
      skipped: campaign.skipped,
      finished_at: new Date().toISOString(),
    });
  }
}
