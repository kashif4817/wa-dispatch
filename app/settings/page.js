"use client";

import { Archive, Clock, Database, Globe2, Loader2 } from "lucide-react";
import Nav from "@/components/Nav";
import { Section } from "@/components/ui";
import { useCampaignSettings } from "@/lib/settings";

export default function SettingsPage() {
  const { settings, loading, error, update } = useCampaignSettings();

  return (
    <>
      <Nav />
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5">
        <Section title="Settings" eyebrow="Storage and app behavior" icon={Database}>
          <div className="grid gap-4">
            <label className="flex items-center justify-between gap-4 border border-zinc-800 bg-zinc-950 p-4">
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center border border-zinc-700 bg-black text-emerald-300">
                  <Archive size={18} />
                </span>
                <span>
                  <span className="block font-black text-zinc-100">Save attachments to history</span>
                  <span className="block max-w-2xl text-sm leading-6 text-zinc-500">
                    When enabled, campaign attachments upload to Supabase Storage so they can be viewed later in campaign history. When disabled, files are sent directly to WhatsApp only.
                  </span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.saveAttachmentsToHistory}
                onChange={(event) => update({ saveAttachmentsToHistory: event.target.checked })}
                className="h-5 w-5 shrink-0 accent-emerald-400"
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-3">
              <label className="border border-zinc-800 bg-zinc-950 p-4">
                <span className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-200">
                  <Globe2 className="text-emerald-300" size={16} /> Default country code
                </span>
                <input
                  className="field h-11 px-3 mono"
                  value={settings.defaultCountryCode}
                  onChange={(event) => update({ defaultCountryCode: event.target.value })}
                  placeholder="92"
                />
              </label>

              <label className="border border-zinc-800 bg-zinc-950 p-4">
                <span className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-200">
                  <Clock className="text-emerald-300" size={16} /> Min delay seconds
                </span>
                <input
                  className="field h-11 px-3 mono"
                  type="number"
                  min="1"
                  value={settings.minDelaySeconds}
                  onChange={(event) => update({ minDelaySeconds: event.target.value })}
                />
              </label>

              <label className="border border-zinc-800 bg-zinc-950 p-4">
                <span className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-200">
                  <Clock className="text-emerald-300" size={16} /> Max delay seconds
                </span>
                <input
                  className="field h-11 px-3 mono"
                  type="number"
                  min={settings.minDelaySeconds}
                  value={settings.maxDelaySeconds}
                  onChange={(event) => update({ maxDelaySeconds: event.target.value })}
                />
              </label>
            </div>

            <div className="border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-xs uppercase text-zinc-500">Current send mode</p>
              <p className={`mono mt-2 text-lg font-black ${settings.saveAttachmentsToHistory ? "text-emerald-300" : "text-zinc-400"}`}>
                {settings.saveAttachmentsToHistory ? "save attachments to history" : "send attachments direct only"}
              </p>
              <p className="mt-3 text-sm text-zinc-500">
                Delay settings are applied from the dashboard campaign button.
              </p>
              {loading ? <p className="mt-3 flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="animate-spin" size={14} /> Syncing settings</p> : null}
              {error ? <p className="mt-3 text-sm font-bold text-rose-300">{error}</p> : null}
            </div>
          </div>
        </Section>
      </main>
    </>
  );
}
