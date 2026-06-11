import { normalizeNumber } from "./parsers";

export function normalizeOptOutNumber(number, defaultCountryCode = "") {
  const normalized = normalizeNumber(number, defaultCountryCode);
  return normalized.valid ? normalized.digits : String(number || "").replace(/\D/g, "");
}

export async function loadOptOutSet(supabase, recipients, defaultCountryCode = "") {
  if (!supabase || !recipients?.length) return new Set();

  const numbers = [...new Set(
    recipients
      .map((recipient) => normalizeOptOutNumber(recipient.number, defaultCountryCode))
      .filter(Boolean)
  )];
  if (!numbers.length) return new Set();

  const { data, error } = await supabase
    .from("opt_outs")
    .select("number")
    .in("number", numbers);
  if (error) throw error;

  return new Set((data || []).map((row) => normalizeOptOutNumber(row.number, defaultCountryCode)));
}

export async function loadCooldownSet(supabase, recipients, defaultCountryCode = "", cooldownHours = 0) {
  if (!supabase || !recipients?.length || Number(cooldownHours) <= 0) return new Set();

  const numbers = [...new Set(
    recipients
      .map((recipient) => normalizeOptOutNumber(recipient.number, defaultCountryCode))
      .filter(Boolean)
  )];
  if (!numbers.length) return new Set();

  const since = new Date(Date.now() - Number(cooldownHours) * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("send_logs")
    .select("number")
    .in("number", numbers)
    .eq("status", "sent")
    .gte("sent_at", since);
  if (error) throw error;

  return new Set((data || []).map((row) => normalizeOptOutNumber(row.number, defaultCountryCode)));
}

export function isOptedOut(recipient, optOutSet, defaultCountryCode = "") {
  const number = normalizeOptOutNumber(recipient?.number, defaultCountryCode);
  return Boolean(number && optOutSet?.has(number));
}

export async function upsertContactFromLog(supabase, { campaignId, number, name, status, sentAt }) {
  if (!supabase || !number) return;

  const patch = {
    number,
    updated_at: new Date().toISOString(),
    name: name || null,
    last_campaign_id: campaignId || null,
  };
  if (status === "sent") {
    patch.last_contacted_at = sentAt || new Date().toISOString();
    patch.total_sent = 1;
  }
  if (status === "failed") patch.total_failed = 1;
  if (status === "skipped") patch.total_skipped = 1;

  const { data: existing, error: existingError } = await supabase
    .from("contact_profiles")
    .select("number,total_sent,total_failed,total_skipped")
    .eq("number", number)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") return;

  if (existing) {
    patch.total_sent = Number(existing.total_sent || 0) + (status === "sent" ? 1 : 0);
    patch.total_failed = Number(existing.total_failed || 0) + (status === "failed" ? 1 : 0);
    patch.total_skipped = Number(existing.total_skipped || 0) + (status === "skipped" ? 1 : 0);
  }

  await supabase.from("contact_profiles").upsert(patch);
}
