import { formatDateTime, normalizeDateText } from "./dateFormat";

export function campaignDisplayTitle(campaign, index = 0) {
  const rawName = normalizeDateText(campaign?.name || "");
  const prefix = /^resend\b/i.test(rawName) ? "Resend" : "Campaign";
  return `${prefix} #${String(index + 1).padStart(2, "0")}`;
}

export function campaignSubtitle(campaign) {
  const rawName = normalizeDateText(campaign?.name || "");
  const created = campaign?.created_at ? formatDateTime(campaign.created_at) : "";
  if (!rawName) return created;
  return created ? `${created} - ${rawName}` : rawName;
}

export function campaignCounts(campaign = {}) {
  const sent = Number(campaign.sent || 0);
  const failed = Number(campaign.failed || 0);
  const skipped = Number(campaign.skipped || 0);
  const configuredTotal = Number(campaign.total || 0);
  const completed = sent + failed + skipped;
  const total = Math.max(configuredTotal, completed);
  const remaining = Math.max(0, total - completed);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { sent, failed, skipped, completed, total, remaining, pct };
}

export function campaignStatus(campaign = {}) {
  const status = String(campaign.status || "").toLowerCase();
  if (["running", "retrying", "paused", "cancelled", "queued", "scheduled"].includes(status)) return status;

  const { sent, failed, skipped, completed } = campaignCounts(campaign);
  if (completed === 0) return "pending";
  if (sent > 0 && (failed > 0 || skipped > 0)) return "partial";
  if (failed > 0 || skipped > 0) return "failed";
  return "completed";
}

export function statusLabel(status = "") {
  const labels = {
    done: "Completed",
    completed: "Completed",
    running: "Running",
    retrying: "Retrying",
    paused: "Paused",
    queued: "Queued",
    scheduled: "Scheduled",
    partial: "Partial",
    failed: "Failed",
    cancelled: "Cancelled",
    pending: "Pending",
  };
  return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

export function statusTone(status = "") {
  const tones = {
    done: "emerald",
    completed: "emerald",
    running: "emerald",
    retrying: "sky",
    queued: "sky",
    scheduled: "amber",
    paused: "amber",
    partial: "amber",
    failed: "rose",
    cancelled: "rose",
    pending: "neutral",
  };
  return tones[status] || "neutral";
}
