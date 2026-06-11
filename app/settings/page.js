"use client";

import { useEffect, useState } from "react";
import { Archive, Clock, Database, Gauge, Globe2, Info, Loader2, ShieldCheck } from "lucide-react";
import Shell from "@/components/Shell";
import ConnectionPanel from "@/components/ConnectionPanel";
import { Button, Section } from "@/components/ui";
import { parsePasteInput, validateRecipients } from "@/lib/parsers";
import { useCampaignSettings } from "@/lib/settings";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

export default function SettingsPage() {
  const { settings, loading, error, update } = useCampaignSettings();

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-1 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">Settings</span>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="flex flex-col gap-5">

        {/* WhatsApp connection lives here, not on dashboard */}
        <ConnectionPanel />

        {/* Campaign settings */}
        <Section title="Campaign Settings" eyebrow="Storage and app behavior" icon={Database}>
          <div className="flex flex-col gap-4">

            <SettingToggle
              icon={Archive}
              label="Save attachments to history"
              description="Upload campaign files to Supabase Storage for later viewing and resend."
              info="When enabled, uploaded campaign attachments are saved with campaign history. It is useful for audit trails and retries, but it uses storage space."
              checked={settings.saveAttachmentsToHistory}
              onChange={(checked) => update({ saveAttachmentsToHistory: checked })}
            />

            {/* Delay + country code */}
            <div className="grid gap-4 lg:grid-cols-3">
              <SettingField icon={Globe2} label="Default country code" info="Used when a pasted number starts with 0. For Pakistan, 0300... becomes 92300... when this value is 92.">
                <input
                  className="field h-10 px-3 mono text-[14px]"
                  value={settings.defaultCountryCode}
                  onChange={(e) => update({ defaultCountryCode: e.target.value })}
                  placeholder="92"
                />
              </SettingField>
              <SettingField icon={Clock} label="Min delay (seconds)" info="The shortest waiting time between two recipients. Random delays reduce robotic sending patterns.">
                <input
                  className="field h-10 px-3 mono text-[14px]"
                  type="number"
                  min="1"
                  value={settings.minDelaySeconds}
                  onChange={(e) => update({ minDelaySeconds: e.target.value })}
                />
              </SettingField>
              <SettingField icon={Clock} label="Max delay (seconds)" info="The longest waiting time between two recipients. Keep this higher than the minimum for natural pacing.">
                <input
                  className="field h-10 px-3 mono text-[14px]"
                  type="number"
                  min={settings.minDelaySeconds}
                  value={settings.maxDelaySeconds}
                  onChange={(e) => update({ maxDelaySeconds: e.target.value })}
                />
              </SettingField>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <SettingField icon={Gauge} label="Daily send cap" info="Stops a campaign from starting if today's sent count plus this campaign would cross the daily safety limit.">
                <input
                  className="field h-10 px-3 mono text-[14px]"
                  type="number"
                  min="1"
                  value={settings.dailySendCap}
                  onChange={(e) => update({ dailySendCap: e.target.value })}
                />
              </SettingField>
              <SettingField icon={Gauge} label="Campaign cap" info="Maximum recipients allowed in one campaign. This keeps accidental large blasts from launching.">
                <input
                  className="field h-10 px-3 mono text-[14px]"
                  type="number"
                  min="1"
                  value={settings.perCampaignCap}
                  onChange={(e) => update({ perCampaignCap: e.target.value })}
                />
              </SettingField>
              <SettingField icon={Clock} label="Cooldown hours" info="Skips contacts who already received a successful campaign within this many hours. Set 0 to disable contact cooldown.">
                <input
                  className="field h-10 px-3 mono text-[14px]"
                  type="number"
                  min="0"
                  value={settings.cooldownHours}
                  onChange={(e) => update({ cooldownHours: e.target.value })}
                />
              </SettingField>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <SettingToggle
                icon={Clock}
                label="Quiet hours"
                description="Hold queued sends during the blocked window."
                info="Quiet hours prevent messages during sensitive times. If a campaign is running during this window, it waits until the quiet end time."
                checked={settings.quietHoursEnabled}
                onChange={(checked) => update({ quietHoursEnabled: checked })}
              />
              <SettingField icon={Clock} label="Quiet start" info="The time when sending should pause. Example: 21:00 means campaigns wait after 9 PM.">
                <input
                  className="field h-10 px-3 mono text-[14px]"
                  type="time"
                  value={settings.quietHoursStart}
                  onChange={(e) => update({ quietHoursStart: e.target.value })}
                />
              </SettingField>
              <SettingField icon={Clock} label="Quiet end" info="The time when queued sending may resume. Example: 09:00 means messages restart after 9 AM.">
                <input
                  className="field h-10 px-3 mono text-[14px]"
                  type="time"
                  value={settings.quietHoursEnd}
                  onChange={(e) => update({ quietHoursEnd: e.target.value })}
                />
              </SettingField>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <SettingToggle
                icon={Gauge}
                label="Adaptive delay"
                description="Slow down when failures or skips rise."
                info="When many recipients fail or skip, the sender automatically increases delay between messages to reduce pressure on the session."
                checked={settings.adaptiveDelayEnabled}
                onChange={(checked) => update({ adaptiveDelayEnabled: checked })}
              />
              <SettingToggle
                icon={Gauge}
                label="Warmup mode"
                description="Use longer delays for safer new-number sending."
                info="Warmup mode forces slower sending. It is helpful when linking a new WhatsApp number or sending after a long inactive period."
                checked={settings.warmupMode}
                onChange={(checked) => update({ warmupMode: checked })}
              />
              <SettingToggle
                icon={ShieldCheck}
                label="Consent check"
                description="Require launch confirmation before sending."
                info="Adds a launch checkbox confirming the contacts expect the message and opt-out numbers should be skipped."
                checked={settings.consentCheckRequired}
                onChange={(checked) => update({ consentCheckRequired: checked })}
              />
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
        <OptOutManager defaultCountryCode={settings.defaultCountryCode} />
          </div>
        </div>
      </div>
    </Shell>
  );
}

function OptOutManager({ defaultCountryCode }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!hasSupabaseConfig()) return;
    const { data, error: loadError } = await getSupabase()
      .from("opt_outs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (loadError) {
      setError(loadError.message);
      return;
    }
    setRows(data || []);
  }

  useEffect(() => { load(); }, []);

  async function importOptOuts() {
    setError("");
    setNotice("");
    const checked = validateRecipients(parsePasteInput(text), defaultCountryCode);
    if (!checked.valid.length) {
      setError("Paste at least one valid number.");
      return;
    }
    const payload = checked.valid.map((recipient) => ({
      number: recipient.number,
      reason: "Imported from settings",
      source: "manual",
    }));
    const { error: upsertError } = await getSupabase()
      .from("opt_outs")
      .upsert(payload, { onConflict: "number" });
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setText("");
    setNotice(`Imported ${payload.length} DND number${payload.length === 1 ? "" : "s"}.`);
    load();
  }

  async function remove(number) {
    const { error: removeError } = await getSupabase().from("opt_outs").delete().eq("number", number);
    if (removeError) setError(removeError.message);
    else load();
  }

  function exportCsv() {
    const body = rows.map((row) => `"${row.number}","${row.reason || ""}","${row.created_at || ""}"`).join("\n");
    const blob = new Blob([`number,reason,created_at\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "opt-outs.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Section
      title="DND / Opt-Outs"
      eyebrow={`${rows.length} blocked numbers`}
      icon={ShieldCheck}
      aside={
        <div className="flex items-center gap-2">
          <InfoTip text="DND / Opt-Outs are numbers that must never receive campaigns. The sender checks this list before sending and skips matching recipients." />
          <Button variant="neutral" size="sm" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <textarea
            className="field mono min-h-36 p-3 text-[13px]"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"Paste DND numbers\n923001234567\n03001234567"}
          />
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={importOptOuts} disabled={!hasSupabaseConfig()}>Import Blocked Numbers</Button>
            {notice && <span className="text-[12px] font-medium text-emerald-500">{notice}</span>}
            {error && <span className="text-[12px] font-medium text-rose-500">{error}</span>}
          </div>
        </div>
        <div className="max-h-56 overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 dark:border-zinc-800 dark:bg-zinc-800/40">
          {rows.length === 0 && <p className="p-4 text-center text-[13px] text-neutral-400">No blocked numbers yet.</p>}
          {rows.map((row) => (
            <div key={row.id || row.number} className="flex items-center justify-between gap-3 border-b border-neutral-100 px-3 py-2 text-[12px] last:border-0 dark:border-zinc-800">
              <span className="mono text-neutral-700 dark:text-zinc-300">{row.number}</span>
              <button type="button" onClick={() => remove(row.number)} className="rounded-lg px-2 py-1 text-rose-500 hover:bg-rose-500/10">
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function SettingToggle({ icon: Icon, label, description, info, checked, onChange }) {
  return (
    <label className="group relative flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 transition hover:border-emerald-200 hover:bg-neutral-100/60 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-emerald-500/30 dark:hover:bg-zinc-800/70">
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-emerald-400">
          <Icon size={16} />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[14px] font-medium text-neutral-800 dark:text-zinc-100">
            {label}
            {info && <InfoTip text={info} />}
          </span>
          <span className="block text-[12px] leading-5 text-neutral-400 dark:text-zinc-500">{description}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${checked ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400 dark:text-zinc-500"}`}>
          {checked ? "Enabled" : "Disabled"}
        </span>
        <span className={`relative h-6 w-11 rounded-full border transition ${checked ? "border-emerald-500 bg-emerald-500" : "border-neutral-300 bg-neutral-200 dark:border-zinc-700 dark:bg-zinc-800"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? "left-[18px]" : "left-0.5"}`} />
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="sr-only"
        />
      </span>
    </label>
  );
}

function SettingField({ icon: Icon, label, info, children }) {
  return (
    <div className="group relative rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 transition hover:border-emerald-200 hover:bg-neutral-100/60 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-emerald-500/30 dark:hover:bg-zinc-800/70">
      <label className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-neutral-600 dark:text-zinc-400">
        <Icon size={14} className="text-emerald-500 dark:text-emerald-400" />
        {label}
        {info && <InfoTip text={info} />}
      </label>
      {children}
    </div>
  );
}

function InfoTip({ text }) {
  return (
    <span className="group/tip relative inline-flex">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 transition group-hover:border-emerald-200 group-hover:text-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
        <Info size={12} />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-7 z-40 w-64 -translate-x-1/2 rounded-xl border border-neutral-200 bg-white p-3 text-left text-[12px] font-normal leading-5 text-neutral-600 opacity-0 shadow-xl shadow-neutral-200/60 transition group-hover/tip:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:shadow-black/30">
        {text}
      </span>
    </span>
  );
}
