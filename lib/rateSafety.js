export const DEFAULT_RATE_LIMITS = {
  dailySendCap: 250,
  perCampaignCap: 500,
  cooldownHours: 24,
  warmupMode: false,
  adaptiveDelayEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: "21:00",
  quietHoursEnd: "09:00",
};

export function sanitizeRateLimits(settings = {}) {
  return {
    dailySendCap: clampInt(settings.dailySendCap, 1, 10000, DEFAULT_RATE_LIMITS.dailySendCap),
    perCampaignCap: clampInt(settings.perCampaignCap, 1, 10000, DEFAULT_RATE_LIMITS.perCampaignCap),
    cooldownHours: clampInt(settings.cooldownHours, 0, 720, DEFAULT_RATE_LIMITS.cooldownHours),
    warmupMode: settings.warmupMode === true,
    adaptiveDelayEnabled: settings.adaptiveDelayEnabled !== false,
    quietHoursEnabled: settings.quietHoursEnabled === true,
    quietHoursStart: normalizeTime(settings.quietHoursStart, DEFAULT_RATE_LIMITS.quietHoursStart),
    quietHoursEnd: normalizeTime(settings.quietHoursEnd, DEFAULT_RATE_LIMITS.quietHoursEnd),
  };
}

export function withinQuietHours(date = new Date(), settings = {}) {
  const limits = sanitizeRateLimits(settings);
  if (!limits.quietHoursEnabled) return false;

  const current = date.getHours() * 60 + date.getMinutes();
  const start = minutesFromTime(limits.quietHoursStart);
  const end = minutesFromTime(limits.quietHoursEnd);

  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function nextAllowedSendTime(date = new Date(), settings = {}) {
  const limits = sanitizeRateLimits(settings);
  if (!withinQuietHours(date, limits)) return date;

  const end = minutesFromTime(limits.quietHoursEnd);
  const next = new Date(date);
  next.setHours(Math.floor(end / 60), end % 60, 0, 0);
  if (next <= date) next.setDate(next.getDate() + 1);
  return next;
}

export function applyAdaptiveDelay(baseMinMs, baseMaxMs, progress = {}, settings = {}) {
  const limits = sanitizeRateLimits(settings);
  let min = Math.max(1000, Number(baseMinMs || 8000));
  let max = Math.max(min, Number(baseMaxMs || 25000));

  if (limits.warmupMode) {
    min = Math.max(min, 20000);
    max = Math.max(max, 60000);
  }

  if (limits.adaptiveDelayEnabled) {
    const attempted = Number(progress.sent || 0) + Number(progress.failed || 0) + Number(progress.skipped || 0);
    const failures = Number(progress.failed || 0) + Number(progress.skipped || 0);
    const issueRate = attempted > 0 ? failures / attempted : 0;
    if (issueRate >= 0.25) {
      min = Math.round(min * 1.5);
      max = Math.round(max * 1.8);
    } else if (issueRate >= 0.1) {
      min = Math.round(min * 1.25);
      max = Math.round(max * 1.4);
    }
  }

  return { minDelayMs: min, maxDelayMs: max };
}

export function classifyFailure(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (!message) return "unknown";
  if (message.includes("opt") || message.includes("unsubscribe") || message.includes("dnd")) return "opt_out";
  if (message.includes("not on whatsapp")) return "not_on_whatsapp";
  if (message.includes("number must") || message.includes("invalid")) return "invalid_number";
  if (message.includes("timed out") || message.includes("timeout")) return "timeout";
  if (message.includes("rate") || message.includes("too many")) return "rate_limit";
  if (message.includes("connection") || message.includes("socket") || message.includes("closed")) return "connection";
  return "send_error";
}

export function pickVariant(message, recipient, index = 0) {
  const variants = parseVariants(message);
  if (variants.length <= 1) return { key: "A", message: variants[0] || "" };
  const selectedIndex = Math.abs(hash(`${recipient?.number || index}:${index}`)) % variants.length;
  return {
    key: String.fromCharCode(65 + selectedIndex),
    message: variants[selectedIndex],
  };
}

export function parseVariants(message) {
  const parts = String(message || "")
    .split(/\n---+\s*(?:variant)?\s*---+\n/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [String(message || "")];
}

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function normalizeTime(value, fallback) {
  const match = String(value || "").match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return fallback;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function minutesFromTime(value) {
  const [hours, minutes] = normalizeTime(value, "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

function hash(value) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = ((result << 5) - result + value.charCodeAt(index)) | 0;
  }
  return result;
}
