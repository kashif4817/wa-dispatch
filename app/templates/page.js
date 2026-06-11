"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Shell from "@/components/Shell";
import { Button, Card, CardListSkeleton, ConfirmDialog } from "@/components/ui";
import { formatDateTime } from "@/lib/dateFormat";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

const emptyEdit = { id: "", name: "", message: "" };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(emptyEdit);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!hasSupabaseConfig()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await getSupabase().from("templates").select("*").order("created_at", { ascending: false });
      setTemplates(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createTemplate() {
    if (!name.trim()) return;
    await getSupabase().from("templates").insert({ name: name.trim(), message_text: message, image_paths: [] });
    setName("");
    setMessage("");
    setShowCreate(false);
    load();
  }

  function startEdit(template) {
    setEditing({ id: template.id, name: template.name || "", message: template.message_text || "" });
  }

  async function updateTemplate() {
    if (!editing.id || !editing.name.trim()) return;
    await getSupabase()
      .from("templates")
      .update({ name: editing.name.trim(), message_text: editing.message })
      .eq("id", editing.id);
    setEditing(emptyEdit);
    load();
  }

  async function removeTemplate() {
    if (!deleteTarget) return;
    await getSupabase().from("templates").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  const filteredTemplates = templates.filter((template) =>
    `${template.name} ${template.message_text}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-2 shrink-0 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">Templates</span>
          <div className="flex h-9 flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm shadow-neutral-200/40 dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-black/10">
            <Search size={14} className="shrink-0 text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search templates..."
              className="w-full bg-transparent text-[12px] text-neutral-700 placeholder-neutral-400 outline-none dark:text-zinc-200 dark:placeholder-zinc-500"
            />
          </div>
          <Button size="sm" onClick={() => { setName(""); setMessage(""); setShowCreate(true); }}>
            <Plus size={14} /> Add Template
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="grid gap-5">
            <div className="flex flex-col gap-3">
              {loading && <CardListSkeleton count={4} />}
              {!loading && filteredTemplates.length === 0 && (
                <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-neutral-200 text-[14px] text-neutral-400 dark:border-zinc-700 dark:text-zinc-600">
                  No templates yet.
                </div>
              )}
              {!loading && filteredTemplates.map((template) => (
                <Card key={template.id}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">{template.name}</h2>
                      <p className="mono text-[11px] text-neutral-400 dark:text-zinc-500">
                        {formatDateTime(template.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="neutral" size="sm" onClick={() => setViewing(template)}><Eye size={13} /></Button>
                      <Button variant="neutral" size="sm" onClick={() => startEdit(template)}><Pencil size={13} /></Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteTarget(template)}><Trash2 size={13} /></Button>
                    </div>
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap text-[13px] leading-6 text-neutral-500 dark:text-zinc-400">
                    {template.message_text}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      <TemplateCreateDialog
        open={showCreate}
        name={name}
        message={message}
        onNameChange={setName}
        onMessageChange={setMessage}
        onCancel={() => setShowCreate(false)}
        onSave={createTemplate}
      />
      <TemplateView template={viewing} onClose={() => setViewing(null)} />
      <TemplateEdit editing={editing} setEditing={setEditing} onSave={updateTemplate} />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete template?"
        description={deleteTarget ? `This will permanently delete "${deleteTarget.name}".` : ""}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeTemplate}
      />
    </Shell>
  );
}

function TemplateCreateDialog({ open, name, message, onNameChange, onMessageChange, onCancel, onSave }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-300 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">Add template</p>
            <p className="mt-1 text-[12px] text-neutral-500 dark:text-zinc-500">Save a reusable campaign message.</p>
          </div>
          <button onClick={onCancel} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <input className="field h-10 px-3 text-[14px]" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Template name" />
          <textarea className="field p-3 text-[14px] leading-7" rows={9} value={message} onChange={(event) => onMessageChange(event.target.value)} placeholder="Message text..." />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSave}><Plus size={15} /> Save Template</Button>
        </div>
      </div>
    </div>
  );
}

function TemplateView({ template, onClose }) {
  if (!template) return null;
  return (
    <div className="fixed inset-0 z-300 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <p className="text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">{template.name}</p>
            <p className="mono mt-0.5 text-[11px] text-neutral-400 dark:text-zinc-500">{formatDateTime(template.created_at)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>
        <p className="max-h-[50vh] overflow-auto whitespace-pre-wrap p-5 text-[14px] leading-7 text-neutral-600 dark:text-zinc-300">
          {template.message_text || "No message text."}
        </p>
      </div>
    </div>
  );
}

function TemplateEdit({ editing, setEditing, onSave }) {
  if (!editing.id) return null;
  return (
    <div className="fixed inset-0 z-300 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4">
          <p className="text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">Edit template</p>
          <p className="mt-1 text-[12px] text-neutral-500 dark:text-zinc-500">Update the saved template name and message.</p>
        </div>
        <div className="flex flex-col gap-3">
          <input className="field h-10 px-3 text-[14px]" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <textarea className="field p-3 text-[14px] leading-7" rows={8} value={editing.message} onChange={(e) => setEditing({ ...editing, message: e.target.value })} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(emptyEdit)}>Cancel</Button>
          <Button onClick={onSave}>Update Template</Button>
        </div>
      </div>
    </div>
  );
}
