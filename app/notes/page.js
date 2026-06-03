"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Pencil, Plus, RefreshCw, Search, StickyNote, Trash2 } from "lucide-react";
import Shell from "@/components/Shell";
import { Button, Card, ConfirmDialog, Section } from "@/components/ui";
import { formatDateTime } from "@/lib/dateFormat";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

const emptyForm = { id: "", title: "", campaign_name: "", body: "" };

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    if (!hasSupabaseConfig()) return;
    const { data } = await getSupabase()
      .from("notes")
      .select("*")
      .order("updated_at", { ascending: false });
    setNotes(data || []);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter((note) =>
      (note.title || "").toLowerCase().includes(query) ||
      (note.campaign_name || "").toLowerCase().includes(query) ||
      (note.body || "").toLowerCase().includes(query)
    );
  }, [notes, search]);

  async function saveNote() {
    setError("");
    if (!form.title.trim()) {
      setError("Please add a note title.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        campaign_name: form.campaign_name.trim() || null,
        body: form.body.trim(),
        updated_at: new Date().toISOString(),
      };
      const supabase = getSupabase();
      const { error: dbError } = form.id
        ? await supabase.from("notes").update(payload).eq("id", form.id)
        : await supabase.from("notes").insert(payload);
      if (dbError) throw dbError;
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message || "Could not save note.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote() {
    if (!deleteTarget) return;
    await getSupabase().from("notes").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    if (form.id === deleteTarget.id) setForm(emptyForm);
    load();
  }

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-1 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">Notes</span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
          <Link href="/campaign/new" className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-emerald-500/25 transition hover:bg-emerald-400">
            <Plus size={14} /> New Campaign
          </Link>
          <button onClick={load} className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700">
            <RefreshCw size={13} /> Refresh
          </button>
          <div className="ml-2 flex h-9 flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm shadow-neutral-200/40 dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-black/10">
            <Search size={14} className="shrink-0 text-neutral-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes..." className="w-full bg-transparent text-[12px] text-neutral-700 placeholder-neutral-400 outline-none dark:text-zinc-200 dark:placeholder-zinc-500" />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
            <Section title={form.id ? "Edit Note" : "Quick Note"} eyebrow="Campaign notes" icon={StickyNote}>
              <div className="flex flex-col gap-3">
                <input className="field h-10 px-3 text-[14px]" value={form.title} onChange={(event) => { setForm({ ...form, title: event.target.value }); setError(""); }} placeholder="Note title" />
                <input className="field h-10 px-3 text-[14px]" value={form.campaign_name} onChange={(event) => setForm({ ...form, campaign_name: event.target.value })} placeholder="Campaign name or context" />
                <textarea className="field min-h-64 resize-y p-3 text-[13px] leading-6" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Write quick notes about campaigns, numbers, follow-ups, or anything else..." />
                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}
                <div className="flex gap-2">
                  {form.id && <Button variant="ghost" onClick={() => setForm(emptyForm)}>Cancel</Button>}
                  <Button className="flex-1" onClick={saveNote} disabled={saving}>
                    <Plus size={15} /> {saving ? "Saving..." : form.id ? "Update Note" : "Save Note"}
                  </Button>
                </div>
              </div>
            </Section>

            <div className="flex flex-col gap-3">
              {filtered.length === 0 && (
                <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-neutral-200 text-[14px] text-neutral-400 dark:border-zinc-700 dark:text-zinc-600">No notes yet.</div>
              )}
              {filtered.map((note) => (
                <Card key={note.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">{note.title}</h2>
                      {note.campaign_name && <p className="mt-0.5 truncate text-[12px] font-medium text-emerald-500 dark:text-emerald-400">{note.campaign_name}</p>}
                      <p className="mono mt-1 text-[11px] text-neutral-400 dark:text-zinc-500">{formatDateTime(note.updated_at || note.created_at)}</p>
                      {note.body && <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-[13px] leading-6 text-neutral-600 dark:text-zinc-300">{note.body}</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="neutral" size="sm" onClick={() => setForm({
                        id: note.id,
                        title: note.title || "",
                        campaign_name: note.campaign_name || "",
                        body: note.body || "",
                      })}><Pencil size={13} /></Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteTarget(note)}><Trash2 size={13} /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete note?"
        description={deleteTarget ? `This will permanently delete "${deleteTarget.title}".` : ""}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteNote}
      />
    </Shell>
  );
}
