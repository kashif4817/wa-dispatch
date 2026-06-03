"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, RefreshCw, Save, ShieldCheck, Upload, X } from "lucide-react";
import { dedupeRecipients, parseJsonText, parsePasteInput, validateRecipients } from "@/lib/parsers";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { Button, Section } from "./ui";

export default function RecipientsInput({ recipients, setRecipients, defaultCountryCode }) {
  const [tab, setTab] = useState("paste");
  const [paste, setPaste] = useState("");
  const [invalid, setInvalid] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [alreadySent, setAlreadySent] = useState([]);
  const [checkingSent, setCheckingSent] = useState(false);
  const [lists, setLists] = useState([]);
  const [listName, setListName] = useState("");

  useEffect(() => {
    if (tab !== "paste") return;
    const parsed = parsePasteInput(paste);
    const { valid, invalid } = validateRecipients(parsed, defaultCountryCode);
    const { unique, duplicates } = dedupeRecipients(valid);
    setRecipients(unique);
    setInvalid(invalid);
    setDuplicates(duplicates);
  }, [paste, defaultCountryCode, setRecipients, tab]);

  useEffect(() => { loadLists(); }, []);

  async function loadLists() {
    if (!hasSupabaseConfig()) return;
    const { data } = await getSupabase().from("recipient_lists").select("*").order("created_at", { ascending: false });
    setLists(data || []);
  }

  async function parseFile(file, format) {
    if (!file) return;
    if (format === "json") {
      const parsed = parseJsonText(await file.text());
      const checked = validateRecipients(parsed, defaultCountryCode);
      const { unique, duplicates } = dedupeRecipients(checked.valid);
      setRecipients(unique);
      setInvalid(checked.invalid);
      setDuplicates(duplicates);
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("format", "csv");
    form.append("defaultCountryCode", defaultCountryCode);
    const response = await fetch("/api/parse", { method: "POST", body: form });
    const data = await response.json();
    const { unique, duplicates } = dedupeRecipients(data.recipients || []);
    setRecipients(unique);
    setInvalid(data.invalid || []);
    setDuplicates(duplicates);
  }

  async function saveList() {
    if (!listName.trim() || !recipients.length || !hasSupabaseConfig()) return;
    await getSupabase().from("recipient_lists").insert({ name: listName.trim(), recipients });
    setListName("");
    loadLists();
  }

  const detectAlreadySent = useCallback(async () => {
    if (!hasSupabaseConfig() || recipients.length === 0) {
      setAlreadySent([]);
      return;
    }
    setCheckingSent(true);
    try {
      const numbers = [...new Set(recipients.map((recipient) => recipient.number).filter(Boolean))];
      const { data } = await getSupabase()
        .from("send_logs")
        .select("number,sent_at,campaign_id")
        .in("number", numbers)
        .eq("status", "sent")
        .order("sent_at", { ascending: false });
      const seen = new Map();
      for (const log of data || []) {
        if (!seen.has(log.number)) seen.set(log.number, log);
      }
      setAlreadySent([...seen.values()]);
    } finally {
      setCheckingSent(false);
    }
  }, [recipients]);

  useEffect(() => {
    const timer = setTimeout(() => { detectAlreadySent(); }, 350);
    return () => clearTimeout(timer);
  }, [detectAlreadySent]);

  function removeAlreadySent(number = null) {
    const sentNumbers = new Set(number ? [number] : alreadySent.map((log) => log.number));
    const next = recipients.filter((recipient) => !sentNumbers.has(recipient.number));
    setRecipients(next);
    setPaste(next.map((item) => item.name ? `${item.name}, ${item.number}` : item.number).join("\n"));
  }

  function loadList(id) {
    const list = lists.find((item) => item.id === id);
    if (!list) return;
    setRecipients(list.recipients || []);
    setInvalid([]);
    setDuplicates([]);
    setPaste((list.recipients || []).map((item) => item.name ? `${item.name}, ${item.number}` : item.number).join("\n"));
  }

  return (
    <Section
      title="Recipients"
      eyebrow="Paste, CSV, JSON, or saved lists"
      icon={ClipboardList}
      aside={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <HeaderStat label="Valid" value={recipients.length} tone="emerald" />
          <HeaderStat label="Invalid" value={invalid.length} tone="rose" />
          <HeaderStat label="Duplicates removed" value={duplicates.length} tone="amber" />
          <HeaderStat label="Already sent" value={alreadySent.length} tone={alreadySent.length ? "rose" : "neutral"} />
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-4 flex gap-1.5">
            {["paste", "csv", "json"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`h-8 rounded-lg px-4 text-[13px] font-medium capitalize transition-all duration-200 ${
                  tab === item
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>

          {tab === "paste" ? (
            <>
              <textarea
                value={paste}
                onChange={(event) => setPaste(event.target.value)}
                rows={6}
                className="field mono min-h-56 resize-y p-4 text-[13px] leading-6"
                placeholder={"923001234567\n03001234567\n923001112222"}
              />
              <p className="mt-2 text-[12px] text-neutral-400 dark:text-zinc-500">
                Paste one recipient per line. Names are optional when separated by comma.
              </p>
              {alreadySent.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[12px] font-medium text-amber-700 dark:text-amber-300">
                      <ShieldCheck size={14} />
                      {alreadySent.length} number{alreadySent.length === 1 ? "" : "s"} already received a campaign.
                    </div>
                    <div className="flex gap-2">
                      <Button variant="neutral" size="sm" onClick={detectAlreadySent} disabled={checkingSent}>
                        <RefreshCw size={13} /> Check
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => removeAlreadySent()}>
                        <X size={13} /> Remove all
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex max-h-28 flex-col gap-1 overflow-auto">
                    {alreadySent.slice(0, 8).map((log) => (
                      <div key={`${log.number}-${log.sent_at}`} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-2.5 py-1.5 text-[12px] dark:bg-zinc-900/60">
                        <span className="mono text-neutral-700 dark:text-zinc-300">{log.number}</span>
                        <button type="button" onClick={() => removeAlreadySent(log.number)} className="rounded-md p-1 text-rose-500 transition hover:bg-rose-500/10">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center transition hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-zinc-700 dark:bg-zinc-800/40 dark:hover:border-emerald-500/60 dark:hover:bg-emerald-500/5">
              <Upload className="mb-2 text-emerald-500" size={22} />
              <span className="text-[13px] font-medium text-neutral-700 dark:text-zinc-300">Upload {tab.toUpperCase()}</span>
              <span className="mt-0.5 text-[11px] text-neutral-400 dark:text-zinc-500">
                {tab === "csv" ? "Required column: number. Optional: name." : '[{"number":"...","name":"..."}] or ["..."]'}
              </span>
              <input
                hidden
                type="file"
                accept={tab === "csv" ? ".csv,text/csv" : ".json,application/json"}
                onChange={(event) => parseFile(event.target.files?.[0], tab)}
              />
            </label>
          )}
        </div>

        <div className="flex flex-col gap-4 pt-12">
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center transition hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-zinc-700 dark:bg-zinc-800/40 dark:hover:border-emerald-500/60 dark:hover:bg-emerald-500/5">
            <Upload className="mb-2 text-emerald-500" size={22} />
            <span className="text-[13px] font-medium text-neutral-700 dark:text-zinc-300">Upload recipients</span>
            <span className="mt-0.5 text-[11px] text-neutral-400 dark:text-zinc-500">CSV or JSON contact list</span>
            <input
              hidden
              type="file"
              accept=".csv,text/csv,.json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                parseFile(file, file.name.toLowerCase().endsWith(".json") ? "json" : "csv");
              }}
            />
          </label>

          <div className="flex flex-col gap-2">
            <select className="field h-10 px-3 text-[13px]" onChange={(event) => loadList(event.target.value)} defaultValue="">
              <option value="">Load saved list...</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.recipients?.length || 0})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                className="field h-10 flex-1 px-3 text-[13px]"
                value={listName}
                onChange={(event) => setListName(event.target.value)}
                placeholder="Save as list..."
              />
              <Button variant="neutral" size="md" onClick={saveList}>
                <Save size={14} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function HeaderStat({ label, value, tone }) {
  const colors = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    rose: "text-rose-500 dark:text-rose-400",
    amber: "text-amber-500 dark:text-amber-400",
    neutral: "text-neutral-600 dark:text-zinc-300",
  };

  return (
    <div className="flex min-w-[92px] items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/60">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">{label}</span>
      <span className={`mono text-[13px] font-semibold ${colors[tone]}`}>{value}</span>
    </div>
  );
}
