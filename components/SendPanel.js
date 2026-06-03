"use client";

import { useState } from "react";
import { Loader2, Rocket, Send } from "lucide-react";
import { campaignName } from "@/lib/dateFormat";
import { useCampaignSettings } from "@/lib/settings";
import { Button, Section, StatCard } from "./ui";

export default function SendPanel({ connected, recipients, message, images, selectedImagePaths = [], onStarted }) {
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const { settings } = useCampaignSettings();

  const estimatedMinutes = Math.ceil(
    (recipients.length * ((Number(settings.minDelaySeconds) + Number(settings.maxDelaySeconds)) / 2)) / 60
  );
  const attachmentCount = images.length + selectedImagePaths.length;
  const disabled = !connected || !recipients.length || (!message.trim() && attachmentCount === 0);

  async function start() {
    if (starting) return;
    setStarting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("recipients", JSON.stringify(recipients));
      form.append("message", message);
      form.append("name", campaignName());
      form.append("options", JSON.stringify({
        minDelayMs: Number(settings.minDelaySeconds) * 1000,
        maxDelayMs: Number(settings.maxDelaySeconds) * 1000,
        defaultCountryCode: settings.defaultCountryCode,
        saveAttachmentsToHistory: settings.saveAttachmentsToHistory,
      }));
      form.append("imagePaths", JSON.stringify(selectedImagePaths));
      images.forEach((file) => form.append("images[]", file, file.name));

      const response = await fetch("/api/send", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Campaign could not start"); return; }
      setConfirming(false);
      onStarted?.(data.campaignId);
    } catch (requestError) {
      setError(requestError.message || "Campaign could not start");
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <Section title="Launch Campaign" eyebrow="Ready to send" icon={Rocket}>
        {!connected && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            WhatsApp is not connected. Go to Settings to connect your device.
          </div>
        )}

        <Button
          className="h-12 w-full text-[15px]"
          disabled={disabled}
          onClick={() => setConfirming(true)}
        >
          <Send size={17} /> Start Campaign
        </Button>

        {error && (
          <p className="mt-3 text-[13px] font-medium text-rose-500 dark:text-rose-400">{error}</p>
        )}
      </Section>

      {confirming && (
        <div className="fixed inset-0 z-300 flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm">
          <div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200/60 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-[18px] font-semibold tracking-tight text-neutral-900 dark:text-zinc-50">
              Confirm Campaign
            </h3>
            <p className="mt-2 text-[14px] leading-6 text-neutral-500 dark:text-zinc-400">
              Sending to{" "}
              <span className="mono font-semibold text-neutral-900 dark:text-zinc-100">{recipients.length}</span>{" "}
              recipients. Estimated time:{" "}
              <span className="mono font-semibold text-neutral-900 dark:text-zinc-100">~{estimatedMinutes} min</span>.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <StatCard label="Attachments" value={attachmentCount} />
              <StatCard
                label="Storage"
                value={settings.saveAttachmentsToHistory ? "Saved to history" : "Direct only"}
                tone={settings.saveAttachmentsToHistory ? "emerald" : "neutral"}
              />
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" disabled={starting} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button disabled={starting} onClick={start}>
                {starting && <Loader2 className="animate-spin" size={15} />}
                {starting ? "Starting…" : "Launch"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
