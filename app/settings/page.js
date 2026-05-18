"use client";

import Link from "next/link";
import { Archive, Clock, Database, Globe2, Loader2, Plus } from "lucide-react";
import Shell from "@/components/Shell";
import ConnectionPanel from "@/components/ConnectionPanel";
import { Section } from "@/components/ui";
import { useCampaignSettings } from "@/lib/settings";

export default function SettingsPage() {
  const { settings, loading, error, update } = useCampaignSettings();

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-1 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">Settings</span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
          <Link
            href="/campaign/new"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-emerald-500/25 transition hover:bg-emerald-400"
          >
            <Plus size={14} /> New Campaign
          </Link>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="flex flex-col gap-5">

        {/* WhatsApp connection lives here, not on dashboard */}
        <ConnectionPanel />

        {/* Campaign settings */}
        <Section title="Campaign Settings" eyebrow="Storage and app behavior" icon={Database}>
          <div className="flex flex-col gap-4">

            {/* Save attachments toggle */}
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 transition hover:bg-neutral-100/60 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/70">
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-emerald-400">
                  <Archive size={16} />
                </span>
                <span>
                  <span className="block text-[14px] font-medium text-neutral-800 dark:text-zinc-100">
                    Save attachments to history
                  </span>
                  <span className="block max-w-xl text-[12px] leading-5 text-neutral-400 dark:text-zinc-500">
                    When enabled, campaign attachments upload to Supabase Storage so they can be viewed later in campaign history.
                  </span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.saveAttachmentsToHistory}
                onChange={(e) => update({ saveAttachmentsToHistory: e.target.checked })}
                className="h-5 w-5 shrink-0 accent-emerald-500"
              />
            </label>

            {/* Delay + country code */}
            <div className="grid gap-4 lg:grid-cols-3">
              <SettingField icon={Globe2} label="Default country code">
                <input
                  className="field h-10 px-3 mono text-[14px]"
                  value={settings.defaultCountryCode}
                  onChange={(e) => update({ defaultCountryCode: e.target.value })}
                  placeholder="92"
                />
              </SettingField>
              <SettingField icon={Clock} label="Min delay (seconds)">
                <input
                  className="field h-10 px-3 mono text-[14px]"
                  type="number"
                  min="1"
                  value={settings.minDelaySeconds}
                  onChange={(e) => update({ minDelaySeconds: e.target.value })}
                />
              </SettingField>
              <SettingField icon={Clock} label="Max delay (seconds)">
                <input
                  className="field h-10 px-3 mono text-[14px]"
                  type="number"
                  min={settings.minDelaySeconds}
                  value={settings.maxDelaySeconds}
                  onChange={(e) => update({ maxDelaySeconds: e.target.value })}
                />
              </SettingField>
            </div>

            {/* Summary row */}
            <div className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">
                Current send mode
              </p>
              <p className={`mono mt-1.5 text-[15px] font-semibold ${settings.saveAttachmentsToHistory ? "text-emerald-500 dark:text-emerald-400" : "text-neutral-400 dark:text-zinc-500"}`}>
                {settings.saveAttachmentsToHistory ? "Save attachments to history" : "Send attachments direct only"}
              </p>
              <p className="mt-2 text-[12px] text-neutral-400 dark:text-zinc-500">
                Delay settings apply when starting a campaign from the Dashboard.
              </p>
              {loading && (
                <p className="mt-3 flex items-center gap-2 text-[12px] text-neutral-400">
                  <Loader2 className="animate-spin" size={13} /> Syncing settings…
                </p>
              )}
              {error && (
                <p className="mt-3 text-[12px] font-medium text-rose-500 dark:text-rose-400">{error}</p>
              )}
            </div>
          </div>
        </Section>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function SettingField({ icon: Icon, label, children }) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
      <label className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-neutral-600 dark:text-zinc-400">
        <Icon size={14} className="text-emerald-500 dark:text-emerald-400" />
        {label}
      </label>
      {children}
    </div>
  );
}
