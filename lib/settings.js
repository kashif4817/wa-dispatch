"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, hasSupabaseConfig } from "./supabase";

export const SAVE_ATTACHMENTS_KEY = "save_attachments_to_history";
export const SAVE_ATTACHMENTS_LOCAL_KEY = "wa_sender_save_attachments_to_history";
export const DEFAULT_COUNTRY_CODE_KEY = "default_country_code";
export const MIN_DELAY_SECONDS_KEY = "min_delay_seconds";
export const MAX_DELAY_SECONDS_KEY = "max_delay_seconds";
export const DEFAULT_COUNTRY_CODE_LOCAL_KEY = "wa_sender_default_country_code";
export const MIN_DELAY_SECONDS_LOCAL_KEY = "wa_sender_min_delay_seconds";
export const MAX_DELAY_SECONDS_LOCAL_KEY = "wa_sender_max_delay_seconds";

const DEFAULT_SETTINGS = {
  saveAttachmentsToHistory: false,
  defaultCountryCode: "92",
  minDelaySeconds: 8,
  maxDelaySeconds: 25,
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
  });
}

function cacheCampaignSettings(settings) {
  localStorage.setItem(SAVE_ATTACHMENTS_LOCAL_KEY, String(settings.saveAttachmentsToHistory));
  localStorage.setItem(DEFAULT_COUNTRY_CODE_LOCAL_KEY, settings.defaultCountryCode);
  localStorage.setItem(MIN_DELAY_SECONDS_LOCAL_KEY, String(settings.minDelaySeconds));
  localStorage.setItem(MAX_DELAY_SECONDS_LOCAL_KEY, String(settings.maxDelaySeconds));
}

function sanitizeSettings(settings) {
  const minDelaySeconds = Math.max(1, Number(settings.minDelaySeconds || DEFAULT_SETTINGS.minDelaySeconds));
  const maxDelaySeconds = Math.max(minDelaySeconds, Number(settings.maxDelaySeconds || DEFAULT_SETTINGS.maxDelaySeconds));

  return {
    saveAttachmentsToHistory: settings.saveAttachmentsToHistory === true,
    defaultCountryCode: String(settings.defaultCountryCode || DEFAULT_SETTINGS.defaultCountryCode).replace(/\D/g, ""),
    minDelaySeconds,
    maxDelaySeconds,
  };
}
