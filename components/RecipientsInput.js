"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Save, Upload } from "lucide-react";
import { dedupeRecipients, parseJsonText, parsePasteInput, validateRecipients } from "@/lib/parsers";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { Button, Section } from "./ui";

export default function RecipientsInput({ recipients, setRecipients, defaultCountryCode }) {
  const [tab, setTab] = useState("paste");
  const [paste, setPaste] = useState("");
  const [invalid, setInvalid] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
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

  useEffect(() => {
    loadLists();
  }, []);

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

  function loadList(id) {
    const list = lists.find((item) => item.id === id);
    if (!list) return;
    setRecipients(list.recipients || []);
    setInvalid([]);
    setDuplicates([]);
    setPaste((list.recipients || []).map((item) => item.number).join("\n"));
  }

  return (
    <Section
      title="Recipients"
      eyebrow="Paste, CSV, JSON, or saved lists"
      icon={ClipboardList}
      aside={<p className="mono text-sm text-zinc-400">{recipients.length} valid · {invalid.length} invalid</p>}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {["paste", "csv", "json"].map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`h-9 border px-4 text-sm font-bold capitalize ${tab === item ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200" : "border-zinc-800 bg-zinc-950 text-zinc-400"}`}>
            {item}
          </button>
        ))}
      </div>

      {tab === "paste" ? (
        <textarea value={paste} onChange={(event) => setPaste(event.target.value)} rows={7} className="field p-4 mono text-sm" placeholder="923001234567&#10;03001234567&#10;923001112222" />
      ) : (
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center border border-dashed border-zinc-700 bg-zinc-950 p-5 text-center hover:border-emerald-500/60">
          <Upload className="mb-3 text-emerald-300" size={26} />
          <span className="font-bold">Upload {tab.toUpperCase()}</span>
          <span className="text-sm text-zinc-500">{tab === "csv" ? "Required column: number. Optional: name." : "[{\"number\":\"...\",\"name\":\"...\"}] or [\"...\"]"}</span>
          <input hidden type="file" accept={tab === "csv" ? ".csv,text/csv" : ".json,application/json"} onChange={(event) => parseFile(event.target.files?.[0], tab)} />
        </label>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <Metric label="Valid" value={recipients.length} tone="emerald" />
          <Metric label="Invalid" value={invalid.length} tone="rose" />
          <Metric label="Duplicates removed" value={duplicates.length} tone="amber" />
        </div>
        <div className="grid gap-2">
          <select className="field h-10 px-3" onChange={(event) => loadList(event.target.value)} defaultValue="">
            <option value="">Load saved list</option>
            {lists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.recipients?.length || 0})</option>)}
          </select>
          <div className="flex gap-2">
            <input className="field h-10 px-3" value={listName} onChange={(event) => setListName(event.target.value)} placeholder="List name" />
            <Button variant="neutral" onClick={saveList}><Save size={16} /></Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Metric({ label, value, tone }) {
  const color = { emerald: "text-emerald-300", rose: "text-rose-300", amber: "text-amber-300" }[tone];
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-3">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className={`mono text-xl font-black ${color}`}>{value}</p>
    </div>
  );
}
