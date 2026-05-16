"use client";

import { useState } from "react";
import { Loader2, Rocket, Send } from "lucide-react";
import { useCampaignSettings } from "@/lib/settings";
import { Button, Section } from "./ui";

export default function SendPanel({ connected, recipients, message, images, onStarted }) {
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const { settings } = useCampaignSettings();

  const estimatedMinutes = Math.ceil((recipients.length * ((Number(settings.minDelaySeconds) + Number(settings.maxDelaySeconds)) / 2)) / 60);
  const disabled = !connected || !recipients.length || (!message.trim() && !images.length);

  async function start() {
    if (starting) return;
    setStarting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("recipients", JSON.stringify(recipients));
      form.append("message", message);
      form.append("name", `Campaign ${new Date().toLocaleString()}`);
      form.append("options", JSON.stringify({
        minDelayMs: Number(settings.minDelaySeconds) * 1000,
        maxDelayMs: Number(settings.maxDelaySeconds) * 1000,
        defaultCountryCode: settings.defaultCountryCode,
        saveAttachmentsToHistory: settings.saveAttachmentsToHistory,
      }));
      images.forEach((file) => form.append("images[]", file, file.name));

      const response = await fetch("/api/send", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Campaign could not start");
        return;
      }
      setConfirming(false);
      onStarted?.(data.campaignId);
    } catch (requestError) {
      setError(requestError.message || "Campaign could not start");
    } finally {
      setStarting(false);
    }
  }

  return (
    <Section title="Campaign" eyebrow="Ready to send" icon={Rocket}>
      <Button className="h-12 w-full text-base" disabled={disabled} onClick={() => setConfirming(true)}>
        <Send size={18} /> Start Campaign
      </Button>
      {error ? <p className="mt-3 text-sm font-bold text-rose-300">{error}</p> : null}

      {confirming ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="control-card w-full max-w-lg rounded-lg p-5">
            <h3 className="text-xl font-black">Confirm campaign</h3>
            <p className="mt-3 leading-7 text-zinc-300">
              You are about to send to <span className="mono font-black text-zinc-50">{recipients.length}</span> recipients.
              Estimated time is about <span className="mono font-black text-zinc-50">{estimatedMinutes}</span> minutes.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-xs uppercase text-zinc-500">Attachments</p>
                <p className="mono text-lg font-black text-emerald-300">{images.length}</p>
              </div>
              <div className="border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-xs uppercase text-zinc-500">Storage</p>
                <p className={`mono text-lg font-black ${settings.saveAttachmentsToHistory ? "text-emerald-300" : "text-zinc-400"}`}>
                  {settings.saveAttachmentsToHistory ? "save to history" : "send direct only"}
                </p>
              </div>
            </div>
            {error ? <p className="mt-3 border border-rose-500/30 bg-rose-500/10 p-3 text-sm font-bold text-rose-200">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" disabled={starting} onClick={() => setConfirming(false)}>Cancel</Button>
              <Button disabled={starting} onClick={start}>
                {starting ? <Loader2 className="animate-spin" size={16} /> : null}
                {starting ? "Starting..." : "Continue"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Section>
  );
}
