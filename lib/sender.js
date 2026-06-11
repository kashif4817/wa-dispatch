import { getSocket, getWhatsAppState } from "./whatsapp";
import { getSupabase, hasSupabaseConfig } from "./supabase";
import { normalizeNumber, personalizeMessage } from "./parsers";
import { isOptedOut, loadCooldownSet, loadOptOutSet, upsertContactFromLog } from "./compliance";
import { applyAdaptiveDelay, classifyFailure, nextAllowedSendTime, pickVariant, withinQuietHours } from "./rateSafety";

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
      queue: [],
      activeJobId: null,
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

function isMissingAdvancedColumn(error) {
  return error?.code === "PGRST204"
    || /column .* does not exist|could not find .* column|schema cache/i.test(error?.message || "");
}

function baseCampaignPatch(patch) {
  const allowed = new Set([
    "finished_at", "name", "message_text", "image_paths", "total",
    "sent", "failed", "skipped", "status", "options",
  ]);
  return Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.has(key)));
}

function baseLogRow(row) {
  const allowed = new Set(["campaign_id", "number", "name", "status", "error", "sent_at"]);
  return Object.fromEntries(Object.entries(row).filter(([key]) => allowed.has(key)));
}

async function updateCampaign(id, patch, { optional = false } = {}) {
  if (!hasSupabaseConfig()) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("campaigns").update(patch).eq("id", id);
  if (!error) return;
  if (isMissingAdvancedColumn(error)) {
    const fallback = baseCampaignPatch(patch);
    if (Object.keys(fallback).length > 0) {
      const { error: retryError } = await supabase.from("campaigns").update(fallback).eq("id", id);
      if (!retryError) return;
      if (!optional) throw retryError;
    }
    return;
  }
  if (!optional) throw error;
}

async function insertLog(row) {
  if (!hasSupabaseConfig()) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("send_logs").insert(row);
  if (!error) return;
  if (isMissingAdvancedColumn(error)) {
    const { error: retryError } = await supabase.from("send_logs").insert(baseLogRow(row));
    if (retryError) throw retryError;
    return;
  }
  throw error;
}

async function updateLog(id, patch) {
  if (!hasSupabaseConfig() || !id) return;
  const supabase = getSupabase();
  const payload = { ...patch, sent_at: new Date().toISOString() };
  const { error } = await supabase.from("send_logs").update(payload).eq("id", id);
  if (!error) return;
  if (isMissingAdvancedColumn(error)) {
    const { error: retryError } = await supabase.from("send_logs").update(baseLogRow(payload)).eq("id", id);
    if (retryError) throw retryError;
    return;
  }
  throw error;
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
  const campaign = state();
  return {
    ...campaign,
    queued: campaign.queue?.length || 0,
    activeJobId: campaign.activeJobId,
  };
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

export async function startCampaign(job) {
  return enqueueCampaign(job);
}

export async function enqueueCampaign(job) {
  const campaign = state();
  const queuedJob = {
    ...job,
    jobId: `${job.campaignId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    queuedAt: new Date().toISOString(),
    scheduledFor: job.options?.scheduledFor || null,
  };

  campaign.queue.push(queuedJob);
  await updateCampaign(job.campaignId, {
    status: queuedJob.scheduledFor && new Date(queuedJob.scheduledFor) > new Date() ? "scheduled" : "queued",
    queued_at: queuedJob.queuedAt,
    scheduled_for: queuedJob.scheduledFor,
    runner_status: "queued",
    queue_position: campaign.queue.length,
  }, { optional: true });
  appendLog({
    status: "queued",
    number: "system",
    message: `Campaign queued at position ${campaign.queue.length}`,
  });
  processQueue().catch((error) => {
    appendLog({ status: "failed", number: "system", message: error.message || "Queue failed" });
  });
  return queuedJob;
}

async function processQueue() {
  const campaign = state();
  if (campaign.activeJobId) return;

  const now = Date.now();
  const index = campaign.queue.findIndex((job) => !job.scheduledFor || new Date(job.scheduledFor).getTime() <= now);
  if (index === -1) {
    const nextJob = campaign.queue
      .filter((job) => job.scheduledFor)
      .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))[0];
    if (nextJob) {
      setTimeout(() => processQueue().catch(() => {}), Math.max(1000, new Date(nextJob.scheduledFor).getTime() - now));
    }
    return;
  }

  const [job] = campaign.queue.splice(index, 1);
  campaign.activeJobId = job.jobId;
  try {
    await runCampaign(job);
  } finally {
    campaign.activeJobId = null;
    campaign.queue = campaign.queue.map((queued, position) => ({ ...queued, queuePosition: position + 1 }));
    processQueue().catch(() => {});
  }
}

async function runCampaign({ campaignId, recipients, message, images, options = {}, retryLogIds = [] }) {
  const campaign = state();
  const sock = getSocket();
  const me = getWhatsAppState().me;
  const retrying = retryLogIds.length > 0;
  const supabase = hasSupabaseConfig() ? getSupabase() : null;
  const startedAt = new Date().toISOString();
  const optOutSet = await loadOptOutSet(supabase, recipients, options.defaultCountryCode);
  const cooldownSet = await loadCooldownSet(supabase, recipients, options.defaultCountryCode, options.cooldownHours);

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

  await updateCampaign(campaignId, {
    status: retrying ? "retrying" : "running",
    runner_status: "running",
    started_at: startedAt,
    queue_position: null,
  }, { optional: true });
  appendLog({
    status: retrying ? "retrying" : "running",
    number: "system",
    message: `${retrying ? "Retry" : "Campaign"} started with ${images.length} attachment(s)`,
  });

  for (let index = 0; index < recipients.length; index += 1) {
    const recipient = recipients[index];
    const retryLogId = retryLogIds[index];
    await waitWhilePaused(campaignId);

    while (withinQuietHours(new Date(), options)) {
      const next = nextAllowedSendTime(new Date(), options);
      campaign.status = "scheduled";
      await updateCampaign(campaignId, {
        status: "scheduled",
        scheduled_for: next.toISOString(),
        runner_status: "waiting_quiet_hours",
      }, { optional: true });
      appendLog({ status: "scheduled", number: "system", message: `Quiet hours active until ${next.toLocaleTimeString()}` });
      await wait(Math.min(60000, Math.max(1000, next.getTime() - Date.now())));
      if (campaign.cancelRequested) break;
    }

    if (campaign.cancelRequested) {
      campaign.status = "cancelled";
      await updateCampaign(campaignId, { status: "cancelled", runner_status: "cancelled", finished_at: new Date().toISOString() }, { optional: true });
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

      if (isOptedOut({ number: normalized.digits }, optOutSet, options.defaultCountryCode)) {
        campaign.skipped += 1;
        const skippedRow = {
          number: normalized.digits,
          name: recipient.name,
          status: "skipped",
          error: "DND/opt-out number skipped",
          failure_category: "opt_out",
          metadata: { source: "opt_outs" },
        };
        if (retryLogId) await updateLog(retryLogId, skippedRow);
        else await insertLog({ campaign_id: campaignId, ...skippedRow });
        await upsertContactFromLog(supabase, { campaignId, ...skippedRow });
        appendLog({ status: "skipped", number: normalized.digits, message: "DND/opt-out number skipped" });
      } else if (cooldownSet.has(normalized.digits)) {
        campaign.skipped += 1;
        const skippedRow = {
          number: normalized.digits,
          name: recipient.name,
          status: "skipped",
          error: `Cooldown active for ${options.cooldownHours}h`,
          failure_category: "cooldown",
          metadata: { cooldownHours: options.cooldownHours },
        };
        if (retryLogId) await updateLog(retryLogId, skippedRow);
        else await insertLog({ campaign_id: campaignId, ...skippedRow });
        await upsertContactFromLog(supabase, { campaignId, ...skippedRow });
        appendLog({ status: "skipped", number: normalized.digits, message: skippedRow.error });
      } else if (me?.number && normalized.digits === me.number) {
        campaign.skipped += 1;
        const skippedRow = { number: normalized.digits, name: recipient.name, status: "skipped", error: "Self-send prevented", failure_category: "self_send" };
        if (retryLogId) {
          await updateLog(retryLogId, skippedRow);
        } else {
          await insertLog({ campaign_id: campaignId, ...skippedRow });
        }
        await upsertContactFromLog(supabase, { campaignId, ...skippedRow });
        appendLog({ status: "skipped", number: normalized.digits, message: "Self-send prevented" });
      } else {
        const [exists] = await sock.onWhatsApp(normalized.jid);
        if (exists?.exists !== true) {
          campaign.skipped += 1;
          const skippedRow = { number: normalized.digits, name: recipient.name, status: "skipped", error: "Number not on WhatsApp", failure_category: "not_on_whatsapp" };
          if (retryLogId) {
            await updateLog(retryLogId, skippedRow);
          } else {
            await insertLog({ campaign_id: campaignId, ...skippedRow });
          }
          await upsertContactFromLog(supabase, { campaignId, ...skippedRow });
          appendLog({ status: "skipped", number: normalized.digits, message: "Number not on WhatsApp" });
        } else {
          const variant = pickVariant(message, recipient, index);
          const text = personalizeMessage(variant.message, recipient);
          await sendAttachments(sock, normalized.jid, text, images, (sentIndex, totalImages, attachment) => {
            appendLog({
              status: "sent",
              number: normalized.digits,
              message: `Attachment ${sentIndex}/${totalImages} sent: ${attachment.name || attachment.type || "file"}`,
            });
          });
          campaign.sent += 1;
          const sentRow = { number: normalized.digits, name: recipient.name, status: "sent", error: null, variant_key: variant.key };
          if (retryLogId) {
            await updateLog(retryLogId, sentRow);
          } else {
            await insertLog({ campaign_id: campaignId, ...sentRow });
          }
          await upsertContactFromLog(supabase, { campaignId, ...sentRow, sentAt: new Date().toISOString() });
          appendLog({ status: "sent", number: normalized.digits, message: retrying ? "Retry sent successfully" : "Delivered to WhatsApp Web" });
        }
      }
    } catch (error) {
      campaign.failed += 1;
      const failedRow = {
        number: normalized.digits || recipient.number,
        name: recipient.name,
        status: "failed",
        error: error.message,
        failure_category: classifyFailure(error),
      };
      if (retryLogId) {
        await updateLog(retryLogId, failedRow);
      } else {
        await insertLog({ campaign_id: campaignId, ...failedRow });
      }
      await upsertContactFromLog(supabase, { campaignId, ...failedRow });
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
      const delay = applyAdaptiveDelay(options.minDelayMs, options.maxDelayMs, campaign, options);
      const delayUntil = Date.now() + randomInt(delay.minDelayMs, delay.maxDelayMs);
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
      runner_status: "done",
      sent: campaign.sent,
      failed: campaign.failed,
      skipped: campaign.skipped,
      finished_at: new Date().toISOString(),
    }, { optional: true });
  }
}
