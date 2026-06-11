"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Clipboard,
  Eye,
  ListChecks,
  MoveRight,
  Pencil,
  Plus,
  Scissors,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react";
import Shell from "@/components/Shell";
import { Button, Card, CardListSkeleton, ConfirmDialog, Section } from "@/components/ui";
import { formatDateTime } from "@/lib/dateFormat";
import { parsePasteInput, validateRecipients } from "@/lib/parsers";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { useCampaignSettings } from "@/lib/settings";

const quickBatchSizes = [50, 100];
const managedStatuses = ["unused", "used", "sent", "failed", "skipped", "partial"];

const statusLabels = {
  unused: "Unused",
  used: "Used",
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
  partial: "Partial",
};

const statusStyles = {
  unused: "bg-neutral-100 text-neutral-500 dark:bg-zinc-800 dark:text-zinc-400",
  used: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  sent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  failed: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  skipped: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  partial: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
};

function recipientText(recipient) {
  return recipient.name ? `${recipient.name}, ${recipient.number}` : recipient.number;
}

function recipientKey(number) {
  return String(number || "").replace(/\D/g, "");
}

function parseLimit(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return Infinity;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : Infinity;
}

function limitRecipients(recipients, limitValue) {
  const limit = parseLimit(limitValue);
  return Number.isFinite(limit) ? recipients.slice(0, limit) : recipients;
}

function StatusChip({ status = "unused", title = "" }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyles[status] || statusStyles.unused}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status] || "Unused"}
    </span>
  );
}

function buildUsageIndex(logs) {
  const map = new Map();
  for (const log of logs || []) {
    const key = recipientKey(log.number);
    if (!key) continue;
    const current = map.get(key) || {
      sent: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      lastAt: "",
      lastStatus: "unused",
      campaignName: "",
      error: "",
    };
    current.total += 1;
    if (log.status === "sent") current.sent += 1;
    if (log.status === "failed") current.failed += 1;
    if (log.status === "skipped") current.skipped += 1;
    if (!current.lastAt || new Date(log.sent_at) > new Date(current.lastAt)) {
      current.lastAt = log.sent_at;
      current.lastStatus = log.status || "used";
      current.campaignName = log.campaigns?.name || log.campaign_id || "";
      current.error = log.error || "";
    }
    current.status = current.sent > 0 && (current.failed > 0 || current.skipped > 0)
      ? "partial"
      : current.sent > 0
        ? "sent"
        : current.failed > 0
          ? "failed"
          : current.skipped > 0
            ? "skipped"
            : "used";
    map.set(key, current);
  }
  return map;
}

function campaignStatusFor(recipient, usageIndex) {
  return usageIndex.get(recipientKey(recipient.number)) || { status: "unused", total: 0 };
}

function manualStatusFor(recipient) {
  return recipient.localStatus || recipient.status || "unused";
}

function listCampaignStatus(list, usageIndex) {
  const recipients = list.recipients || [];
  if (!recipients.length) return "unused";
  const statuses = recipients.map((recipient) => campaignStatusFor(recipient, usageIndex).status);
  const used = statuses.filter((status) => status !== "unused");
  if (!used.length) return "unused";
  if (used.length < recipients.length) return "partial";
  return new Set(used).size === 1 ? used[0] : "partial";
}

function effectiveStatusFor(recipient, usageIndex) {
  const manualStatus = manualStatusFor(recipient);
  return manualStatus !== "unused" ? manualStatus : campaignStatusFor(recipient, usageIndex).status;
}

function statusCountsFor(recipients, usageIndex) {
  return recipients.reduce((acc, recipient) => {
    const status = effectiveStatusFor(recipient, usageIndex);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

function replaceTextRecipients(text, removedRecipients, defaultCountryCode) {
  const removeCounts = new Map();
  for (const recipient of removedRecipients) {
    const key = `${recipient.name || ""}|${recipient.number}`;
    removeCounts.set(key, (removeCounts.get(key) || 0) + 1);
  }

  const nextLines = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const checked = validateRecipients(parsePasteInput(line), defaultCountryCode);
    const recipient = checked.valid[0];
    if (!recipient) {
      nextLines.push(line);
      continue;
    }
    const key = `${recipient.name || ""}|${recipient.number}`;
    const count = removeCounts.get(key) || 0;
    if (count > 0) {
      removeCounts.set(key, count - 1);
    } else {
      nextLines.push(line);
    }
  }
  return nextLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export default function ListsPage() {
  const [lists, setLists] = useState([]);
  const [logs, setLogs] = useState([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [copiedCount, setCopiedCount] = useState(0);
  const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState("grid"); // grid or list
  const { settings } = useCampaignSettings();

  const usageIndex = useMemo(() => buildUsageIndex(logs), [logs]);

  const parsed = useMemo(() => {
    const raw = parsePasteInput(text);
    const checked = validateRecipients(raw, settings.defaultCountryCode);
    return { ...checked, limitedValid: limitRecipients(checked.valid, limit) };
  }, [text, limit, settings.defaultCountryCode]);

  async function load() {
    if (!hasSupabaseConfig()) {
      setLoading(false);
      return;
    }
    try {
      const supabase = getSupabase();
      const [{ data: listData }, { data: logData }] = await Promise.all([
        supabase.from("recipient_lists").select("*").order("created_at", { ascending: false }),
        supabase
          .from("send_logs")
          .select("number,name,status,error,sent_at,campaign_id,campaigns(name)")
          .order("sent_at", { ascending: false })
          .limit(5000),
      ]);
      setLists(listData || []);
      setLogs(logData || []);
    } finally {
      setLoading(false);
    }
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
        .insert({ name: name.trim(), recipients: parsed.limitedValid });
      if (dbError) throw dbError;
      setName("");
      setText("");
      setLimit("");
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err.message || "Failed to save. Check your Supabase connection.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(list) {
    setViewing(list);
  }

  async function removeList() {
    if (!deleteTarget) return;
    await getSupabase().from("recipient_lists").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    await load();
  }

  async function updateListRecipients(listId, recipients) {
    await getSupabase().from("recipient_lists").update({ recipients }).eq("id", listId);
    await load();
    setViewing((current) => current?.id === listId ? { ...current, recipients } : current);
  }

  async function updateListName(listId, nextName) {
    if (!nextName.trim()) return;
    await getSupabase().from("recipient_lists").update({ name: nextName.trim() }).eq("id", listId);
    await load();
    setViewing((current) => current?.id === listId ? { ...current, name: nextName.trim() } : current);
  }

  async function appendToList(listId, recipients) {
    const target = lists.find((list) => list.id === listId);
    if (!target) return;
    const merged = [...(target.recipients || []), ...recipients];
    await getSupabase().from("recipient_lists").update({ recipients: merged }).eq("id", listId);
    await load();
  }

  async function createListFromSelection(listName, recipients) {
    if (!listName.trim() || recipients.length === 0) return;
    await getSupabase().from("recipient_lists").insert({ name: listName.trim(), recipients });
    await load();
  }

  async function copyDraftRecipients(items) {
    const draftText = items.map(recipientText).join("\n");
    if (!draftText) return;
    await navigator.clipboard?.writeText(draftText);
    setCopiedCount(items.length);
  }

  async function cutDraftRecipients(count) {
    const items = parsed.limitedValid.slice(0, count);
    if (!items.length) return;
    await copyDraftRecipients(items);
    setText((current) => replaceTextRecipients(current, items, settings.defaultCountryCode));
  }

  const filteredLists = lists.filter((list) =>
    (list.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-emerald-500 dark:border-zinc-700 dark:bg-zinc-800">
              <ListChecks size={18} />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold text-neutral-900 dark:text-zinc-50">Lists</h1>
              <p className="text-[12px] text-neutral-500 dark:text-zinc-400">{lists.length} contact lists</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => { setName(""); setText(""); setLimit(""); setError(""); setShowCreate(true); }}>
              <Plus size={14} /> Add List
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="border-b border-neutral-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-4">
            <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 dark:border-zinc-700 dark:bg-zinc-800">
              <Search size={14} className="shrink-0 text-neutral-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search lists by name..."
                className="w-full bg-transparent text-[12px] text-neutral-700 placeholder-neutral-400 outline-none dark:text-zinc-200 dark:placeholder-zinc-500"
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1 rounded text-[12px] font-medium transition ${
                  viewMode === "grid"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1 rounded text-[12px] font-medium transition ${
                  viewMode === "list"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("compact")}
                className={`px-3 py-1 rounded text-[12px] font-medium transition ${
                  viewMode === "compact"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                Compact
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && <CardListSkeleton count={6} />}
          {!loading && filteredLists.length === 0 && (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-neutral-200 text-[14px] text-neutral-400 dark:border-zinc-700 dark:text-zinc-600">
              {search ? "No lists match your search" : "No lists yet. Create one to get started."}
            </div>
          )}
          {!loading && filteredLists.length > 0 && viewMode === "grid" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredLists.map((list) => {
                const campaignStatus = listCampaignStatus(list, usageIndex);
                const manualMarked = (list.recipients || []).filter((recipient) => manualStatusFor(recipient) !== "unused").length;
                return (
                  <div
                    key={list.id}
                    className="group relative rounded-xl border border-neutral-200 bg-white p-4 hover:shadow-md transition dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden"
                  >
                    {/* top row: name + contacts badge */}
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h3 className="truncate text-[14px] font-semibold text-neutral-900 dark:text-zinc-50">{list.name}</h3>
                      <div className="ml-2 shrink-0">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[12px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {list.recipients?.length || 0}
                        </span>
                      </div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-1.5">
                      <StatusChip status={campaignStatus} />
                      {manualMarked > 0 && <span className="text-[10px] text-neutral-400 dark:text-zinc-500 px-2 py-1">+{manualMarked} marked</span>}
                    </div>

                    <p className="text-[11px] text-neutral-400 dark:text-zinc-500 mb-3">{formatDateTime(list.created_at)}</p>

                    {/* floating delete (top-right) */}
                    <button
                      onClick={() => setDeleteTarget(list)}
                      className="absolute top-3 right-3 z-10 inline-flex items-center justify-center h-8 w-8 rounded-md border border-neutral-200 bg-white text-neutral-600 opacity-0 group-hover:opacity-100 transition dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      title="Delete list"
                    >
                      <Trash2 size={14} />
                    </button>

                    {/* action icons only, appear on hover */}
                    <div className="flex gap-2 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition">
                      <Button variant="neutral" size="sm" onClick={() => setViewing(list)} title="View" className="p-2">
                        <Eye size={14} />
                      </Button>
                      <Button variant="neutral" size="sm" onClick={() => startEdit(list)} title="Edit" className="p-2">
                        <Pencil size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!loading && filteredLists.length > 0 && viewMode === "list" && (
            <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white overflow-hidden dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900">
              {filteredLists.map((list) => {
                const campaignStatus = listCampaignStatus(list, usageIndex);
                const manualMarked = (list.recipients || []).filter((recipient) => manualStatusFor(recipient) !== "unused").length;
                return (
                  <div key={list.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-50 transition dark:hover:bg-zinc-800">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[14px] font-semibold text-neutral-900 dark:text-zinc-50">{list.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="mono text-[12px] text-emerald-500 dark:text-emerald-400">{list.recipients?.length || 0} contacts</span>
                        <StatusChip status={campaignStatus} />
                        {manualMarked > 0 && <span className="text-[10px] text-neutral-400 dark:text-zinc-500">+{manualMarked} marked</span>}
                        <span className="text-[11px] text-neutral-400 dark:text-zinc-500">{formatDateTime(list.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="neutral" size="sm" onClick={() => setViewing(list)} title="View numbers">
                        <Eye size={12} />
                      </Button>
                      <Button variant="neutral" size="sm" onClick={() => startEdit(list)} title="Edit list">
                        <Pencil size={12} />
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteTarget(list)} title="Delete list">
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!loading && filteredLists.length > 0 && viewMode === "compact" && (
            <div className="space-y-2">
              {filteredLists.map((list) => {
                const campaignStatus = listCampaignStatus(list, usageIndex);
                return (
                  <div key={list.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 hover:bg-neutral-50 transition dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-neutral-900 dark:text-zinc-50">{list.name}</p>
                      <p className="text-[11px] text-neutral-500 dark:text-zinc-400">
                        <span className="font-medium text-emerald-500 dark:text-emerald-400">{list.recipients?.length || 0}</span> contacts
                      </p>
                    </div>
                    <StatusChip status={campaignStatus} />
                    <div className="flex gap-1.5 shrink-0">
                      <Button variant="neutral" size="sm" onClick={() => setViewing(list)} className="text-xs">
                        <Eye size={11} />
                      </Button>
                      <Button variant="neutral" size="sm" onClick={() => startEdit(list)} className="text-xs">
                        <Pencil size={11} />
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteTarget(list)} className="text-xs">
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ListCreateDialog
        open={showCreate}
        name={name}
        text={text}
        limit={limit}
        parsed={parsed}
        copiedCount={copiedCount}
        error={error}
        saving={saving}
        onNameChange={(value) => { setName(value); setError(""); }}
        onTextChange={(value) => { setText(value); setError(""); }}
        onLimitChange={setLimit}
        onCopyDraftRecipients={copyDraftRecipients}
        onCutDraftRecipients={cutDraftRecipients}
        onCancel={() => { setShowCreate(false); setError(""); }}
        onSave={createList}
      />
      <ListView
        list={viewing}
        lists={lists}
        copiedCount={copiedCount}
        setCopiedCount={setCopiedCount}
        defaultCountryCode={settings.defaultCountryCode}
        usageIndex={usageIndex}
        onClose={() => setViewing(null)}
        onUpdateRecipients={updateListRecipients}
        onRename={updateListName}
        onAppendToList={appendToList}
        onCreateList={createListFromSelection}
      />
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

function ListCreateDialog({
  open,
  name,
  text,
  limit,
  parsed,
  copiedCount,
  error,
  saving,
  onNameChange,
  onTextChange,
  onLimitChange,
  onCopyDraftRecipients,
  onCutDraftRecipients,
  onCancel,
  onSave,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-300 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200/80 bg-neutral-50 text-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-emerald-400">
              <ListChecks size={17} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">Add list</p>
              <p className="mt-1 text-[12px] text-neutral-500 dark:text-zinc-500">Paste recipients and save them as a reusable list.</p>
            </div>
          </div>
          <button onClick={onCancel} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <input className="field h-10 px-3 text-[14px]" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="List name" />
          <textarea className="field mono min-h-48 p-3 text-[13px]" rows={8} value={text} onChange={(event) => onTextChange(event.target.value)} placeholder={"One number per line\n923001234567\n03001234567"} />
          <label className="text-[12px] text-neutral-500 dark:text-zinc-500">
            Limit
            <input className="field mt-1 h-10 w-full px-3 text-[13px]" value={limit} onChange={(event) => onLimitChange(event.target.value)} placeholder="Infinity" inputMode="numeric" />
          </label>
          {text.trim() && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-3 text-[12px]">
                <span className="text-emerald-500 dark:text-emerald-400">{parsed.limitedValid.length} will save</span>
                {parsed.valid.length !== parsed.limitedValid.length && <span className="text-amber-500 dark:text-amber-400">{parsed.valid.length - parsed.limitedValid.length} over limit</span>}
                {parsed.invalid.length > 0 && <span className="text-rose-400 dark:text-rose-400">{parsed.invalid.length} invalid</span>}
                <span className="text-neutral-400 dark:text-zinc-500">{copiedCount} copied last</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickBatchSizes.map((size) => (
                  <Button key={`copy-${size}`} variant="neutral" size="sm" onClick={() => onCopyDraftRecipients(parsed.limitedValid.slice(0, size))} disabled={!parsed.limitedValid.length}>
                    <Clipboard size={13} /> Copy {size}
                  </Button>
                ))}
                {quickBatchSizes.map((size) => (
                  <Button key={`cut-${size}`} variant="danger" size="sm" onClick={() => onCutDraftRecipients(size)} disabled={!parsed.limitedValid.length}>
                    <Scissors size={13} /> Cut {size}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>
            <Plus size={15} /> {saving ? "Saving..." : "Save List"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ListView({ list, lists, copiedCount, setCopiedCount, defaultCountryCode, usageIndex, onClose, onUpdateRecipients, onRename, onAppendToList, onCreateList }) {
  const [selected, setSelected] = useState([]);
  const [moveTarget, setMoveTarget] = useState("");
  const [newListName, setNewListName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [editIndex, setEditIndex] = useState(null);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [listName, setListName] = useState("");

  useEffect(() => {
    setSelected([]);
    setMoveTarget("");
    setNewListName("");
    setPasteText("");
    setEditIndex(null);
    setListName(list?.name || "");
  }, [list?.id, list?.name]);

  if (!list) return null;

  const recipients = list.recipients || [];
  const selectedSet = new Set(selected);
  const selectedRecipients = recipients.filter((_, index) => selectedSet.has(index));
  const allSelected = recipients.length > 0 && selected.length === recipients.length;
  const pasteCheck = validateRecipients(parsePasteInput(pasteText), defaultCountryCode);
  const statusCounts = statusCountsFor(recipients, usageIndex);

  function setFirst(count) {
    setSelected(recipients.slice(0, count).map((_, index) => index));
  }

  function toggle(index) {
    setSelected((current) => current.includes(index)
      ? current.filter((item) => item !== index)
      : [...current, index]);
  }

  async function copyRecipients(items = selectedRecipients) {
    const text = items.map(recipientText).join("\n");
    if (!text) return;
    await navigator.clipboard?.writeText(text);
    setCopiedCount(items.length);
  }

  function recipientsWithStatus(status) {
    return recipients.filter((recipient) => effectiveStatusFor(recipient, usageIndex) === status);
  }

  function selectStatus(status) {
    setSelected(recipients
      .map((recipient, index) => effectiveStatusFor(recipient, usageIndex) === status ? index : null)
      .filter((index) => index !== null));
  }

  async function cutRecipients(items = selectedRecipients) {
    if (!items.length) return;
    await copyRecipients(items);
    const cutNumbers = new Set(items.map((recipient) => `${recipient.name || ""}|${recipient.number}`));
    const next = recipients.filter((recipient) => !cutNumbers.has(`${recipient.name || ""}|${recipient.number}`));
    await onUpdateRecipients(list.id, next);
    setSelected([]);
  }

  async function moveSelected() {
    if (!selectedRecipients.length) return;
    if (moveTarget) await onAppendToList(moveTarget, selectedRecipients);
    if (!moveTarget && newListName.trim()) await onCreateList(newListName, selectedRecipients);
    if (moveTarget || newListName.trim()) {
      const selectedIndexes = new Set(selected);
      await onUpdateRecipients(list.id, recipients.filter((_, index) => !selectedIndexes.has(index)));
      setSelected([]);
      setNewListName("");
      setMoveTarget("");
    }
  }

  async function moveRecipients(items) {
    if (!items.length || (!moveTarget && !newListName.trim())) return;
    if (moveTarget) await onAppendToList(moveTarget, items);
    if (!moveTarget && newListName.trim()) await onCreateList(newListName, items);
    const moveCounts = new Map();
    for (const recipient of items) {
      const key = `${recipient.name || ""}|${recipient.number}`;
      moveCounts.set(key, (moveCounts.get(key) || 0) + 1);
    }
    const next = recipients.filter((recipient) => {
      const key = `${recipient.name || ""}|${recipient.number}`;
      const count = moveCounts.get(key) || 0;
      if (count > 0) {
        moveCounts.set(key, count - 1);
        return false;
      }
      return true;
    });
    await onUpdateRecipients(list.id, next);
    setSelected([]);
    setNewListName("");
    setMoveTarget("");
  }

  async function addPasted() {
    if (!pasteCheck.valid.length) return;
    await onUpdateRecipients(list.id, [...recipients, ...pasteCheck.valid]);
    setPasteText("");
  }

  async function deleteSelected() {
    if (!selected.length) return;
    const selectedIndexes = new Set(selected);
    await onUpdateRecipients(list.id, recipients.filter((_, index) => !selectedIndexes.has(index)));
    setSelected([]);
  }

  async function markSelected(status) {
    if (!selected.length) return;
    const selectedIndexes = new Set(selected);
    await onUpdateRecipients(list.id, recipients.map((recipient, index) =>
      selectedIndexes.has(index) ? { ...recipient, localStatus: status } : recipient
    ));
  }

  function startRecipientEdit(index) {
    const recipient = recipients[index];
    setEditIndex(index);
    setEditName(recipient.name || "");
    setEditNumber(recipient.number || "");
  }

  async function saveRecipientEdit() {
    const checked = validateRecipients([{ name: editName, number: editNumber }], defaultCountryCode);
    if (!checked.valid.length || editIndex === null) return;
    await onUpdateRecipients(list.id, recipients.map((recipient, index) =>
      index === editIndex ? { ...recipient, ...checked.valid[0] } : recipient
    ));
    setEditIndex(null);
  }

  async function saveListName() {
    if (!listName.trim() || listName.trim() === list.name) return;
    await onRename(list.id, listName);
  }

  return (
    <div className="fixed inset-0 z-300 flex bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full h-full max-h-screen flex rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden relative">
        
        {/* LEFT PANEL - ACTIONS */}
        <div className="w-full sm:w-96 flex flex-col border-r border-neutral-100 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-900/50">
          
          {/* Header with List Name (close moved to top-right) */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4 dark:border-zinc-800">
            <div className="min-w-0 flex-1">
              <input 
                className="field h-9 px-3 text-[14px] font-semibold w-full text-neutral-900 dark:text-zinc-50" 
                value={listName} 
                onChange={(event) => setListName(event.target.value)} 
                onBlur={saveListName} 
              />
            </div>
          </div>

          {/* Floating close button (top-right) */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 inline-flex items-center justify-center h-9 w-9 rounded-lg border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-50"
            title="Close"
          >
            <X size={16} />
          </button>

          {/* Stats */}
          <div className="border-b border-neutral-200 px-5 py-3 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white text-neutral-700 dark:bg-zinc-800 dark:text-zinc-300 font-medium">
                <span>{recipients.length}</span>
                <span className="text-neutral-500 dark:text-zinc-400">recipients</span>
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-medium transition ${selected.length ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-white text-neutral-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                <span>{selected.length}</span>
                <span>selected</span>
              </span>
            </div>
          </div>

          {/* Scrollable Actions Panel */}
          <div className="flex-1 overflow-y-auto">
            
            {/* Selection Controls */}
            <div className="border-b border-neutral-200 px-5 py-3 dark:border-zinc-800">
              <p className="text-[10px] font-semibold text-neutral-600 dark:text-zinc-400 uppercase tracking-wider mb-2.5">Selection</p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={() => setSelected(allSelected ? [] : recipients.map((_, index) => index))} className="justify-center text-xs">
                  {allSelected ? <Check size={12} /> : <Square size={12} />} {allSelected ? "Clear" : "Select"}
                </Button>
                {quickBatchSizes.map((size) => (
                  <Button key={`select-${size}`} variant="neutral" size="sm" onClick={() => setFirst(size)} className="justify-center text-xs">
                    {size}
                  </Button>
                ))}
              </div>
            </div>

            {/* Copy & Delete Actions */}
            <div className="border-b border-neutral-200 px-5 py-3 dark:border-zinc-800">
              <p className="text-[10px] font-semibold text-neutral-600 dark:text-zinc-400 uppercase tracking-wider mb-2.5">Actions</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="neutral" size="sm" onClick={() => copyRecipients()} disabled={!selected.length} className="justify-center text-xs">
                  <Clipboard size={12} /> Copy
                </Button>
                <Button variant="danger" size="sm" onClick={deleteSelected} disabled={!selected.length} className="justify-center text-xs">
                  <Trash2 size={12} /> Delete
                </Button>
                {quickBatchSizes.map((size) => (
                  <Button key={`copy-${size}`} variant="neutral" size="sm" onClick={() => copyRecipients(recipients.slice(0, size))} className="justify-center text-xs">
                    <Clipboard size={11} /> {size}
                  </Button>
                ))}
                {quickBatchSizes.map((size) => (
                  <Button key={`cut-${size}`} variant="danger" size="sm" onClick={() => cutRecipients(recipients.slice(0, size))} className="justify-center text-xs">
                    <Scissors size={11} /> {size}
                  </Button>
                ))}
              </div>
            </div>

            {/* Status Management */}
            <div className="border-b border-neutral-200 px-5 py-3 dark:border-zinc-800">
              <p className="text-[10px] font-semibold text-neutral-600 dark:text-zinc-400 uppercase tracking-wider mb-2.5">Status Groups</p>
              <div className="flex flex-col gap-2">
                {managedStatuses.map((status) => (
                  <div key={status} className="flex items-center gap-2 p-1.5 rounded-lg border border-neutral-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
                    <button type="button" onClick={() => selectStatus(status)} className="flex-1 flex items-center gap-1 text-[10px] font-medium text-neutral-700 hover:text-neutral-900 dark:text-zinc-300 dark:hover:text-zinc-100">
                      <StatusChip status={status} /> <span className="mono text-[9px]">{statusCounts[status] || 0}</span>
                    </button>
                    <button type="button" onClick={() => copyRecipients(recipientsWithStatus(status))} disabled={!statusCounts[status]} className="p-1 rounded text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 dark:hover:bg-zinc-700 dark:hover:text-zinc-100" title={`Copy ${statusLabels[status]}`}>
                      <Clipboard size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {managedStatuses.map((status) => (
                  <Button key={`mark-${status}`} variant="neutral" size="sm" onClick={() => markSelected(status)} disabled={!selected.length} className="text-xs justify-center">
                    <UserCheck size={11} /> {statusLabels[status]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Move/Transfer */}
            <div className="border-b border-neutral-200 px-5 py-3 dark:border-zinc-800">
              <p className="text-[10px] font-semibold text-neutral-600 dark:text-zinc-400 uppercase tracking-wider mb-2.5">Move</p>
              <div className="flex flex-col gap-2">
                <select className="field h-8 px-2 text-[11px]" value={moveTarget} onChange={(event) => { setMoveTarget(event.target.value); setNewListName(""); }}>
                  <option value="">Existing list...</option>
                  {lists.filter((item) => item.id !== list.id).map((item) => (
                    <option key={item.id} value={item.id}>{item.name} ({item.recipients?.length})</option>
                  ))}
                </select>
                <input className="field h-8 px-2 text-[11px]" value={newListName} onChange={(event) => { setNewListName(event.target.value); setMoveTarget(""); }} placeholder="Or new list..." />
                <Button onClick={moveSelected} disabled={!selected.length || (!moveTarget && !newListName.trim())} className="justify-center text-xs">
                  <MoveRight size={12} /> Move
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  {quickBatchSizes.map((size) => (
                    <Button key={`move-${size}`} variant="neutral" size="sm" onClick={() => moveRecipients(recipients.slice(0, size))} disabled={!recipients.length || (!moveTarget && !newListName.trim())} className="text-xs justify-center">
                      <MoveRight size={11} /> {size}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Add More Recipients */}
            <div className="border-b border-neutral-200 px-5 py-3 dark:border-zinc-800">
              <p className="text-[10px] font-semibold text-neutral-600 dark:text-zinc-400 uppercase tracking-wider mb-2.5">Add Recipients</p>
              <div className="flex flex-col gap-2">
                <textarea className="field mono min-h-14 p-2 text-[10px]" value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Paste numbers..." />
                <Button onClick={addPasted} disabled={!pasteCheck.valid.length} className="justify-center text-xs">
                  <Plus size={12} /> Add {pasteCheck.valid.length || "0"}
                </Button>
                {pasteCheck.invalid.length > 0 && <span className="text-[9px] text-rose-500 text-center">⚠ {pasteCheck.invalid.length} invalid</span>}
              </div>
            </div>

            {/* Edit Recipient Mode */}
            {editIndex !== null && (
              <div className="border-b border-neutral-200 bg-blue-50 dark:border-zinc-800 dark:bg-blue-500/10 px-5 py-3">
                <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2.5">Edit Recipient</p>
                <div className="flex flex-col gap-2">
                  <input className="field h-8 px-2 text-[11px]" value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Name" />
                  <input className="field h-8 px-2 text-[11px]" value={editNumber} onChange={(event) => setEditNumber(event.target.value)} placeholder="Number" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={saveRecipientEdit} size="sm" className="text-xs justify-center"><Check size={11} /> Save</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditIndex(null)} className="text-xs justify-center">Cancel</Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rename Button at Bottom */}
          <div className="border-t border-neutral-200 px-5 py-3 dark:border-zinc-800">
            <Button onClick={saveListName} disabled={!listName.trim() || listName.trim() === list.name} className="w-full justify-center text-sm">
              <Check size={14} /> Save Changes
            </Button>
          </div>
        </div>

        {/* RIGHT PANEL - CONTACTS LIST */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="border-b border-neutral-100 px-6 py-3 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-900/50">
            <p className="text-[13px] font-semibold text-neutral-900 dark:text-zinc-50">Recipients ({recipients.length})</p>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="p-6">
              {recipients.length === 0 ? (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-neutral-200 text-[13px] text-neutral-400 dark:border-zinc-700 dark:text-zinc-500">
                  No recipients in this list
                </div>
              ) : (
                <div className="space-y-2">
                  {recipients.map((recipient, index) => {
                    const campaignUsage = campaignStatusFor(recipient, usageIndex);
                    const manualStatus = manualStatusFor(recipient);
                    return (
                      <div 
                        key={`${recipient.number}-${index}`} 
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[12px] transition ${
                          selectedSet.has(index) 
                            ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30" 
                            : "bg-white border-neutral-100 hover:bg-neutral-50 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <button 
                          type="button" 
                          onClick={() => toggle(index)} 
                          className={`grid h-6 w-6 place-items-center rounded-md border transition shrink-0 ${
                            selectedSet.has(index) 
                              ? "border-emerald-500 bg-emerald-500 text-white" 
                              : "border-neutral-300 text-neutral-400 hover:border-emerald-400 dark:border-zinc-600 dark:text-zinc-500 dark:hover:border-emerald-400"
                          }`}
                        >
                          {selectedSet.has(index) ? <Check size={12} /> : null}
                        </button>
                        <span className="mono text-neutral-400 dark:text-zinc-600 font-medium min-w-fit text-[11px]">#{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-neutral-900 dark:text-zinc-100">{recipient.name || "No name"}</p>
                          <p className="mono text-neutral-500 dark:text-zinc-400 text-[10px] truncate">{recipient.number}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                          <StatusChip status={campaignUsage.status} title={campaignUsage.error || campaignUsage.campaignName || ""} />
                          {manualStatus !== "unused" && <StatusChip status={manualStatus} title="Manual mark" />}
                        </div>
                        <Button variant="neutral" size="sm" onClick={() => startRecipientEdit(index)} title="Edit recipient" className="shrink-0"><Pencil size={11} /></Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
