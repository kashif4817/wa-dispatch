"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AlertCircle, Eye, ListChecks, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import Shell from "@/components/Shell";
import { Button, Card, ConfirmDialog, Section } from "@/components/ui";
import { formatDateTime } from "@/lib/dateFormat";
import { parsePasteInput, validateRecipients } from "@/lib/parsers";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { useCampaignSettings } from "@/lib/settings";

const emptyEdit = { id: "", name: "", text: "", error: "" };

export default function ListsPage() {
  const [lists, setLists] = useState([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(emptyEdit);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { settings } = useCampaignSettings();

  const parsed = useMemo(() => {
    const raw = parsePasteInput(text);
    return validateRecipients(raw, settings.defaultCountryCode);
  }, [text, settings.defaultCountryCode]);

  async function load() {
    if (!hasSupabaseConfig()) return;
    const { data } = await getSupabase()
      .from("recipient_lists")
      .select("*")
      .order("created_at", { ascending: false });
    setLists(data || []);
  }

  useEffect(() => { load(); }, []);

  async function createList() {
    setError("");
    if (!name.trim()) { setError("Please enter a list name."); return; }
    if (parsed.valid.length === 0) {
      setError(parsed.invalid.length > 0
        ? `No valid numbers found - ${parsed.invalid.length} invalid (need 8-15 digits with country code).`
        : "Paste at least one phone number.");
      return;
    }
    setSaving(true);
    try {
      const { error: dbError } = await getSupabase()
        .from("recipient_lists")
        .insert({ name: name.trim(), recipients: parsed.valid });
      if (dbError) throw dbError;
      setName("");
      setText("");
      load();
    } catch (err) {
      setError(err.message || "Failed to save. Check your Supabase connection.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(list) {
    setEditing({
      id: list.id,
      name: list.name || "",
      text: (list.recipients || []).map((recipient) => recipient.name ? `${recipient.name}, ${recipient.number}` : recipient.number).join("\n"),
      error: "",
    });
  }

  async function updateList() {
    if (!editing.name.trim()) {
      setEditing({ ...editing, error: "Please enter a list name." });
      return;
    }
    const checked = validateRecipients(parsePasteInput(editing.text), settings.defaultCountryCode);
    if (checked.valid.length === 0) {
      setEditing({
        ...editing,
        error: checked.invalid.length > 0
          ? `No valid numbers found - ${checked.invalid.length} invalid.`
          : "Add at least one recipient.",
      });
      return;
    }
    await getSupabase()
      .from("recipient_lists")
      .update({ name: editing.name.trim(), recipients: checked.valid })
      .eq("id", editing.id);
    setEditing(emptyEdit);
    load();
  }

  async function removeList() {
    if (!deleteTarget) return;
    await getSupabase().from("recipient_lists").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  const filteredLists = lists.filter((list) =>
    list.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-1 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">Lists</span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
          <Link href="/campaign/new" className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-emerald-500/25 transition hover:bg-emerald-400">
            <Plus size={14} /> New Campaign
          </Link>
          <button onClick={load} className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700">
            <RefreshCw size={13} /> Refresh
          </button>
          <div className="ml-2 flex h-9 flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm shadow-neutral-200/40 dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-black/10">
            <Search size={14} className="shrink-0 text-neutral-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search lists..." className="w-full bg-transparent text-[12px] text-neutral-700 placeholder-neutral-400 outline-none dark:text-zinc-200 dark:placeholder-zinc-500" />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
            <Section title="New List" eyebrow="Add list" icon={ListChecks}>
              <div className="flex flex-col gap-3">
                <input className="field h-10 px-3 text-[14px]" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="List name" />
                <textarea className="field mono p-3 text-[13px]" rows={10} value={text} onChange={(e) => { setText(e.target.value); setError(""); }} placeholder={"One number per line\n923001234567\n03001234567"} />
                {text.trim() && (
                  <div className="flex gap-3 text-[12px]">
                    <span className="text-emerald-500 dark:text-emerald-400">{parsed.valid.length} valid</span>
                    {parsed.invalid.length > 0 && <span className="text-rose-400 dark:text-rose-400">{parsed.invalid.length} invalid</span>}
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}
                <Button onClick={createList} disabled={saving}>
                  <Plus size={15} /> {saving ? "Saving..." : "Save List"}
                </Button>
              </div>
            </Section>

            <div className="flex flex-col gap-3">
              {filteredLists.length === 0 && (
                <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-neutral-200 text-[14px] text-neutral-400 dark:border-zinc-700 dark:text-zinc-600">No lists yet.</div>
              )}
              {filteredLists.map((list) => (
                <Card key={list.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">{list.name}</h2>
                      <p className="mono mt-0.5 text-[13px] text-emerald-500 dark:text-emerald-400">{list.recipients?.length || 0} recipients</p>
                      <p className="mono text-[11px] text-neutral-400 dark:text-zinc-500">{formatDateTime(list.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="neutral" size="sm" onClick={() => setViewing(list)}><Eye size={13} /></Button>
                      <Button variant="neutral" size="sm" onClick={() => startEdit(list)}><Pencil size={13} /></Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteTarget(list)}><Trash2 size={13} /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ListView list={viewing} onClose={() => setViewing(null)} />
      <ListEdit editing={editing} setEditing={setEditing} onSave={updateList} />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete list?"
        description={deleteTarget ? `This will permanently delete "${deleteTarget.name}" and its saved recipients.` : ""}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeList}
      />
    </Shell>
  );
}

function ListView({ list, onClose }) {
  if (!list) return null;
  return (
    <div className="fixed inset-0 z-300 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <p className="text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">{list.name}</p>
            <p className="mono mt-0.5 text-[11px] text-emerald-500 dark:text-emerald-400">{list.recipients?.length || 0} recipients</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-auto p-5">
          {(list.recipients || []).map((recipient, index) => (
            <div key={`${recipient.number}-${index}`} className="grid grid-cols-[36px_1fr_150px] gap-3 border-b border-neutral-100 py-2.5 text-[13px] last:border-0 dark:border-zinc-800">
              <span className="mono text-neutral-300 dark:text-zinc-700">{index + 1}</span>
              <span className="text-neutral-700 dark:text-zinc-300">{recipient.name || "No name"}</span>
              <span className="mono text-neutral-500 dark:text-zinc-400">{recipient.number}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListEdit({ editing, setEditing, onSave }) {
  if (!editing.id) return null;
  return (
    <div className="fixed inset-0 z-300 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4">
          <p className="text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">Edit list</p>
          <p className="mt-1 text-[12px] text-neutral-500 dark:text-zinc-500">Update the saved audience name and recipients.</p>
        </div>
        <div className="flex flex-col gap-3">
          <input className="field h-10 px-3 text-[14px]" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value, error: "" })} />
          <textarea className="field mono p-3 text-[13px]" rows={10} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value, error: "" })} />
          {editing.error && <p className="text-[12px] font-medium text-rose-500 dark:text-rose-400">{editing.error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(emptyEdit)}>Cancel</Button>
          <Button onClick={onSave}>Update List</Button>
        </div>
      </div>
    </div>
  );
}
