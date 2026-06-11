"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, hasSupabaseConfig } from "./supabase";

export const SAVE_ATTACHMENTS_KEY = "save_attachments_to_history";
export const SAVE_ATTACHMENTS_LOCAL_KEY = "wa_sender_save_attachments_to_history";
export const DEFAULT_COUNTRY_CODE_KEY = "default_country_code";
export const MIN_DELAY_SECONDS_KEY = "min_delay_seconds";
export const MAX_DELAY_SECONDS_KEY = "max_delay_seconds";
export const QUIET_HOURS_ENABLED_KEY = "quiet_hours_enabled";
export const QUIET_HOURS_START_KEY = "quiet_hours_start";
export const QUIET_HOURS_END_KEY = "quiet_hours_end";
export const DAILY_SEND_CAP_KEY = "daily_send_cap";
export const PER_CAMPAIGN_CAP_KEY = "per_campaign_cap";
export const COOLDOWN_HOURS_KEY = "cooldown_hours";
export const WARMUP_MODE_KEY = "warmup_mode";
export const ADAPTIVE_DELAY_ENABLED_KEY = "adaptive_delay_enabled";
export const CONSENT_CHECK_REQUIRED_KEY = "consent_check_required";
export const DEFAULT_COUNTRY_CODE_LOCAL_KEY = "wa_sender_default_country_code";
export const MIN_DELAY_SECONDS_LOCAL_KEY = "wa_sender_min_delay_seconds";
export const MAX_DELAY_SECONDS_LOCAL_KEY = "wa_sender_max_delay_seconds";
export const QUIET_HOURS_ENABLED_LOCAL_KEY = "wa_sender_quiet_hours_enabled";
export const QUIET_HOURS_START_LOCAL_KEY = "wa_sender_quiet_hours_start";
export const QUIET_HOURS_END_LOCAL_KEY = "wa_sender_quiet_hours_end";
export const DAILY_SEND_CAP_LOCAL_KEY = "wa_sender_daily_send_cap";
export const PER_CAMPAIGN_CAP_LOCAL_KEY = "wa_sender_per_campaign_cap";
export const COOLDOWN_HOURS_LOCAL_KEY = "wa_sender_cooldown_hours";
export const WARMUP_MODE_LOCAL_KEY = "wa_sender_warmup_mode";
export const ADAPTIVE_DELAY_ENABLED_LOCAL_KEY = "wa_sender_adaptive_delay_enabled";
export const CONSENT_CHECK_REQUIRED_LOCAL_KEY = "wa_sender_consent_check_required";

const DEFAULT_SETTINGS = {
  saveAttachmentsToHistory: false,
  defaultCountryCode: "92",
  minDelaySeconds: 8,
  maxDelaySeconds: 25,
  quietHoursEnabled: false,
  quietHoursStart: "21:00",
  quietHoursEnd: "09:00",
  dailySendCap: 250,
  perCampaignCap: 500,
  cooldownHours: 24,
  warmupMode: false,
  adaptiveDelayEnabled: true,
  consentCheckRequired: true,
};

export function useSaveAttachmentsSetting() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const cached = localStorage.getItem(SAVE_ATTACHMENTS_LOCAL_KEY);
    if (cached !== null) setEnabled(cached === "true");

    async function load() {
      setError("");
      try {
        if (!hasSupabaseConfig()) return;
        const { data, error } = await getSupabase()
          .from("app_settings")
          .select("value")
          .eq("key", SAVE_ATTACHMENTS_KEY)
          .maybeSingle();

        if (error) throw error;
        if (typeof data?.value === "boolean") {
          setEnabled(data.value);
          localStorage.setItem(SAVE_ATTACHMENTS_LOCAL_KEY, String(data.value));
        }
      } catch (loadError) {
        setError(loadError.message || "Could not load setting");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const update = useCallback(async (nextEnabled) => {
    setEnabled(nextEnabled);
    setError("");
    localStorage.setItem(SAVE_ATTACHMENTS_LOCAL_KEY, String(nextEnabled));

    try {
      if (!hasSupabaseConfig()) return;
      const { error } = await getSupabase()
        .from("app_settings")
        .upsert({
          key: SAVE_ATTACHMENTS_KEY,
          value: nextEnabled,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    } catch (updateError) {
      setError(updateError.message || "Could not save setting");
    }
  }, []);

  return { enabled, loading, error, update };
}

export function useCampaignSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setSettings(readCachedCampaignSettings());

    async function load() {
      setError("");
      try {
        if (!hasSupabaseConfig()) return;
        const { data, error } = await getSupabase()
          .from("app_settings")
          .select("key,value")
          .in("key", [
            SAVE_ATTACHMENTS_KEY,
            DEFAULT_COUNTRY_CODE_KEY,
            MIN_DELAY_SECONDS_KEY,
            MAX_DELAY_SECONDS_KEY,
            QUIET_HOURS_ENABLED_KEY,
            QUIET_HOURS_START_KEY,
            QUIET_HOURS_END_KEY,
            DAILY_SEND_CAP_KEY,
            PER_CAMPAIGN_CAP_KEY,
            COOLDOWN_HOURS_KEY,
            WARMUP_MODE_KEY,
            ADAPTIVE_DELAY_ENABLED_KEY,
            CONSENT_CHECK_REQUIRED_KEY,
          ]);

        if (error) throw error;

        const nextSettings = { ...readCachedCampaignSettings() };
        for (const row of data || []) {
          if (row.key === SAVE_ATTACHMENTS_KEY && typeof row.value === "boolean") {
            nextSettings.saveAttachmentsToHistory = row.value;
          }
          if (row.key === DEFAULT_COUNTRY_CODE_KEY && typeof row.value === "string") {
            nextSettings.defaultCountryCode = row.value;
          }
          if (row.key === MIN_DELAY_SECONDS_KEY && Number.isFinite(Number(row.value))) {
            nextSettings.minDelaySeconds = Number(row.value);
          }
          if (row.key === MAX_DELAY_SECONDS_KEY && Number.isFinite(Number(row.value))) {
            nextSettings.maxDelaySeconds = Number(row.value);
          }
          if (row.key === QUIET_HOURS_ENABLED_KEY && typeof row.value === "boolean") nextSettings.quietHoursEnabled = row.value;
          if (row.key === QUIET_HOURS_START_KEY && typeof row.value === "string") nextSettings.quietHoursStart = row.value;
          if (row.key === QUIET_HOURS_END_KEY && typeof row.value === "string") nextSettings.quietHoursEnd = row.value;
          if (row.key === DAILY_SEND_CAP_KEY && Number.isFinite(Number(row.value))) nextSettings.dailySendCap = Number(row.value);
          if (row.key === PER_CAMPAIGN_CAP_KEY && Number.isFinite(Number(row.value))) nextSettings.perCampaignCap = Number(row.value);
          if (row.key === COOLDOWN_HOURS_KEY && Number.isFinite(Number(row.value))) nextSettings.cooldownHours = Number(row.value);
          if (row.key === WARMUP_MODE_KEY && typeof row.value === "boolean") nextSettings.warmupMode = row.value;
          if (row.key === ADAPTIVE_DELAY_ENABLED_KEY && typeof row.value === "boolean") nextSettings.adaptiveDelayEnabled = row.value;
          if (row.key === CONSENT_CHECK_REQUIRED_KEY && typeof row.value === "boolean") nextSettings.consentCheckRequired = row.value;
        }

        cacheCampaignSettings(nextSettings);
        setSettings(nextSettings);
      } catch (loadError) {
        setError(loadError.message || "Could not load settings");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const update = useCallback(async (patch) => {
    const nextSettings = sanitizeSettings({ ...settings, ...patch });
    setSettings(nextSettings);
    setError("");
    cacheCampaignSettings(nextSettings);

    try {
      if (!hasSupabaseConfig()) return;
      const rows = [
        { key: SAVE_ATTACHMENTS_KEY, value: nextSettings.saveAttachmentsToHistory },
        { key: DEFAULT_COUNTRY_CODE_KEY, value: nextSettings.defaultCountryCode },
        { key: MIN_DELAY_SECONDS_KEY, value: nextSettings.minDelaySeconds },
        { key: MAX_DELAY_SECONDS_KEY, value: nextSettings.maxDelaySeconds },
        { key: QUIET_HOURS_ENABLED_KEY, value: nextSettings.quietHoursEnabled },
        { key: QUIET_HOURS_START_KEY, value: nextSettings.quietHoursStart },
        { key: QUIET_HOURS_END_KEY, value: nextSettings.quietHoursEnd },
        { key: DAILY_SEND_CAP_KEY, value: nextSettings.dailySendCap },
        { key: PER_CAMPAIGN_CAP_KEY, value: nextSettings.perCampaignCap },
        { key: COOLDOWN_HOURS_KEY, value: nextSettings.cooldownHours },
        { key: WARMUP_MODE_KEY, value: nextSettings.warmupMode },
        { key: ADAPTIVE_DELAY_ENABLED_KEY, value: nextSettings.adaptiveDelayEnabled },
        { key: CONSENT_CHECK_REQUIRED_KEY, value: nextSettings.consentCheckRequired },
      ].map((row) => ({ ...row, updated_at: new Date().toISOString() }));

      const { error } = await getSupabase().from("app_settings").upsert(rows);
      if (error) throw error;
    } catch (updateError) {
      setError(updateError.message || "Could not save settings");
    }
  }, [settings]);

  return { settings, loading, error, update };
}

export function readCachedCampaignSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  return sanitizeSettings({
    saveAttachmentsToHistory: localStorage.getItem(SAVE_ATTACHMENTS_LOCAL_KEY) === "true",
    defaultCountryCode: localStorage.getItem(DEFAULT_COUNTRY_CODE_LOCAL_KEY) || DEFAULT_SETTINGS.defaultCountryCode,
    minDelaySeconds: Number(localStorage.getItem(MIN_DELAY_SECONDS_LOCAL_KEY) || DEFAULT_SETTINGS.minDelaySeconds),
    maxDelaySeconds: Number(localStorage.getItem(MAX_DELAY_SECONDS_LOCAL_KEY) || DEFAULT_SETTINGS.maxDelaySeconds),
    quietHoursEnabled: localStorage.getItem(QUIET_HOURS_ENABLED_LOCAL_KEY) === "true",
    quietHoursStart: localStorage.getItem(QUIET_HOURS_START_LOCAL_KEY) || DEFAULT_SETTINGS.quietHoursStart,
    quietHoursEnd: localStorage.getItem(QUIET_HOURS_END_LOCAL_KEY) || DEFAULT_SETTINGS.quietHoursEnd,
    dailySendCap: Number(localStorage.getItem(DAILY_SEND_CAP_LOCAL_KEY) || DEFAULT_SETTINGS.dailySendCap),
    perCampaignCap: Number(localStorage.getItem(PER_CAMPAIGN_CAP_LOCAL_KEY) || DEFAULT_SETTINGS.perCampaignCap),
    cooldownHours: Number(localStorage.getItem(COOLDOWN_HOURS_LOCAL_KEY) || DEFAULT_SETTINGS.cooldownHours),
    warmupMode: localStorage.getItem(WARMUP_MODE_LOCAL_KEY) === "true",
    adaptiveDelayEnabled: localStorage.getItem(ADAPTIVE_DELAY_ENABLED_LOCAL_KEY) !== "false",
    consentCheckRequired: localStorage.getItem(CONSENT_CHECK_REQUIRED_LOCAL_KEY) !== "false",
  });
}

function cacheCampaignSettings(settings) {
  localStorage.setItem(SAVE_ATTACHMENTS_LOCAL_KEY, String(settings.saveAttachmentsToHistory));
  localStorage.setItem(DEFAULT_COUNTRY_CODE_LOCAL_KEY, settings.defaultCountryCode);
  localStorage.setItem(MIN_DELAY_SECONDS_LOCAL_KEY, String(settings.minDelaySeconds));
  localStorage.setItem(MAX_DELAY_SECONDS_LOCAL_KEY, String(settings.maxDelaySeconds));
  localStorage.setItem(QUIET_HOURS_ENABLED_LOCAL_KEY, String(settings.quietHoursEnabled));
  localStorage.setItem(QUIET_HOURS_START_LOCAL_KEY, settings.quietHoursStart);
  localStorage.setItem(QUIET_HOURS_END_LOCAL_KEY, settings.quietHoursEnd);
  localStorage.setItem(DAILY_SEND_CAP_LOCAL_KEY, String(settings.dailySendCap));
  localStorage.setItem(PER_CAMPAIGN_CAP_LOCAL_KEY, String(settings.perCampaignCap));
  localStorage.setItem(COOLDOWN_HOURS_LOCAL_KEY, String(settings.cooldownHours));
  localStorage.setItem(WARMUP_MODE_LOCAL_KEY, String(settings.warmupMode));
  localStorage.setItem(ADAPTIVE_DELAY_ENABLED_LOCAL_KEY, String(settings.adaptiveDelayEnabled));
  localStorage.setItem(CONSENT_CHECK_REQUIRED_LOCAL_KEY, String(settings.consentCheckRequired));
}

function sanitizeSettings(settings) {
  const minDelaySeconds = Math.max(1, Number(settings.minDelaySeconds || DEFAULT_SETTINGS.minDelaySeconds));
  const maxDelaySeconds = Math.max(minDelaySeconds, Number(settings.maxDelaySeconds || DEFAULT_SETTINGS.maxDelaySeconds));
  const dailySendCap = Math.max(1, Number(settings.dailySendCap || DEFAULT_SETTINGS.dailySendCap));
  const perCampaignCap = Math.max(1, Number(settings.perCampaignCap || DEFAULT_SETTINGS.perCampaignCap));
  const cooldownHours = Math.max(0, Number(settings.cooldownHours || DEFAULT_SETTINGS.cooldownHours));

  return {
    saveAttachmentsToHistory: settings.saveAttachmentsToHistory === true,
    defaultCountryCode: String(settings.defaultCountryCode || DEFAULT_SETTINGS.defaultCountryCode).replace(/\D/g, ""),
    minDelaySeconds,
    maxDelaySeconds,
    quietHoursEnabled: settings.quietHoursEnabled === true,
    quietHoursStart: normalizeTime(settings.quietHoursStart, DEFAULT_SETTINGS.quietHoursStart),
    quietHoursEnd: normalizeTime(settings.quietHoursEnd, DEFAULT_SETTINGS.quietHoursEnd),
    dailySendCap,
    perCampaignCap,
    cooldownHours,
    warmupMode: settings.warmupMode === true,
    adaptiveDelayEnabled: settings.adaptiveDelayEnabled !== false,
    consentCheckRequired: settings.consentCheckRequired !== false,
  };
}

function normalizeTime(value, fallback) {
  const match = String(value || "").match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return fallback;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}
