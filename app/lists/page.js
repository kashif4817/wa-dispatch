"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Clipboard,
  Eye,
  ListChecks,
  MoveRight,
  Pencil,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  Send,
  Square,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import Shell from "@/components/Shell";
import { Button, Card, ConfirmDialog, Section } from "@/components/ui";
import { formatDateTime } from "@/lib/dateFormat";
import { parsePasteInput, validateRecipients } from "@/lib/parsers";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { useCampaignSettings } from "@/lib/settings";

const emptyEdit = { id: "", name: "", text: "", limit: "", error: "" };

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

export default function ListsPage() {
  const [lists, setLists] = useState([]);
  const [logs, setLogs] = useState([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [numberSearch, setNumberSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(emptyEdit);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [copiedCount, setCopiedCount] = useState(0);
  const { settings } = useCampaignSettings();

  const usageIndex = useMemo(() => buildUsageIndex(logs), [logs]);

  const parsed = useMemo(() => {
    const raw = parsePasteInput(text);
    const checked = validateRecipients(raw, settings.defaultCountryCode);
    return { ...checked, limitedValid: limitRecipients(checked.valid, limit) };
  }, [text, limit, settings.defaultCountryCode]);

  async function load() {
    if (!hasSupabaseConfig()) return;
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
    setEditing({
      id: list.id,
      name: list.name || "",
      text: (list.recipients || []).map(recipientText).join("\n"),
      limit: "",
      error: "",
    });
  }

  async function updateList() {
    if (!editing.name.trim()) {
      setEditing({ ...editing, error: "Please enter a list name." });
      return;
    }
    const checked = validateRecipients(parsePasteInput(editing.text), settings.defaultCountryCode);
    const recipients = limitRecipients(checked.valid, editing.limit);
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
      .update({ name: editing.name.trim(), recipients })
      .eq("id", editing.id);
    setEditing(emptyEdit);
    await load();
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

  async function markList(list, status) {
    await updateListRecipients(list.id, (list.recipients || []).map((recipient) => ({ ...recipient, localStatus: status })));
  }

  const filteredLists = lists.filter((list) =>
    (list.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const allNumbers = useMemo(() => lists.flatMap((list) =>
    (list.recipients || []).map((recipient, index) => ({
      list,
      recipient,
      index,
      campaignUsage: campaignStatusFor(recipient, usageIndex),
      manualStatus: manualStatusFor(recipient),
    }))
  ), [lists, usageIndex]);

  const filteredNumbers = useMemo(() => {
    const query = numberSearch.trim().toLowerCase();
    if (!query) return allNumbers.slice(0, 40);
    return allNumbers.filter(({ list, recipient, campaignUsage, manualStatus }) =>
      recipientKey(recipient.number).includes(recipientKey(query)) ||
      String(recipient.number || "").toLowerCase().includes(query) ||
      String(recipient.name || "").toLowerCase().includes(query) ||
      String(list.name || "").toLowerCase().includes(query) ||
      campaignUsage.status.includes(query) ||
      manualStatus.includes(query)
    ).slice(0, 120);
  }, [allNumbers, numberSearch]);

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-1 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">Lists</span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
          <Button size="sm" onClick={() => setShowCreate((open) => !open)}>
            <Plus size={14} /> New List
          </Button>
          <Link href="/campaign/new" className="flex h-8 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-[13px] font-semibold text-white shadow-sm shadow-emerald-500/25 transition hover:bg-emerald-400">
            <Send size={14} /> New Campaign
          </Link>
          <button onClick={load} className="flex h-8 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700">
            <RefreshCw size={13} /> Refresh
          </button>
          <div className="ml-2 flex h-8 flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm shadow-neutral-200/40 dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-black/10">
            <Search size={14} className="shrink-0 text-neutral-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search lists..." className="w-full bg-transparent text-[12px] text-neutral-700 placeholder-neutral-400 outline-none dark:text-zinc-200 dark:placeholder-zinc-500" />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
            <div className="flex flex-col gap-4">
              <Section title="Find Number" eyebrow="All lists" icon={Search}>
                <div className="flex flex-col gap-3">
                  <input className="field h-10 px-3 text-[14px]" value={numberSearch} onChange={(e) => setNumberSearch(e.target.value)} placeholder="Search any number, name, list, or status" />
                  <div className="max-h-[320px] overflow-auto rounded-xl border border-neutral-100 dark:border-zinc-800">
                    {filteredNumbers.length === 0 && (
                      <div className="grid h-28 place-items-center text-[13px] text-neutral-400 dark:text-zinc-500">No numbers found.</div>
                    )}
                    {filteredNumbers.map(({ list, recipient, index, campaignUsage, manualStatus }) => (
                      <div key={`${list.id}-${recipient.number}-${index}`} className="grid grid-cols-[1fr_auto] gap-2 border-b border-neutral-100 p-3 text-[12px] last:border-0 dark:border-zinc-800">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-neutral-800 dark:text-zinc-100">{recipient.name || "No name"}</p>
                          <p className="mono mt-0.5 text-neutral-500 dark:text-zinc-400">{recipient.number}</p>
                          <p className="mt-1 truncate text-neutral-400 dark:text-zinc-500">{list.name}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <StatusChip status={campaignUsage.status} title={campaignUsage.error || campaignUsage.campaignName || ""} />
                          {manualStatus !== "unused" && <StatusChip status={manualStatus} title="Manual mark" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>

              {showCreate && (
                <Section title="New List" eyebrow="Add list" icon={ListChecks}>
                  <div className="flex flex-col gap-3">
                    <input className="field h-10 px-3 text-[14px]" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="List name" />
                    <div className="grid gap-2 sm:grid-cols-[1fr_130px]">
                      <textarea className="field mono min-h-48 p-3 text-[13px] sm:col-span-2" rows={8} value={text} onChange={(e) => { setText(e.target.value); setError(""); }} placeholder={"One number per line\n923001234567\n03001234567"} />
                      <label className="text-[12px] text-neutral-500 dark:text-zinc-500 sm:col-span-2">
                        Limit
                        <input className="field mt-1 h-10 w-full px-3 text-[13px]" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Infinity" inputMode="numeric" />
                      </label>
                    </div>
                    {text.trim() && (
                      <div className="flex flex-wrap gap-3 text-[12px]">
                        <span className="text-emerald-500 dark:text-emerald-400">{parsed.limitedValid.length} will save</span>
                        {parsed.valid.length !== parsed.limitedValid.length && <span className="text-amber-500 dark:text-amber-400">{parsed.valid.length - parsed.limitedValid.length} over limit</span>}
                        {parsed.invalid.length > 0 && <span className="text-rose-400 dark:text-rose-400">{parsed.invalid.length} invalid</span>}
                        <span className="text-neutral-400 dark:text-zinc-500">{copiedCount} copied last</span>
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
              )}
            </div>

            <div className="flex flex-col gap-3">
              {filteredLists.length === 0 && (
                <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-neutral-200 text-[14px] text-neutral-400 dark:border-zinc-700 dark:text-zinc-600">No lists yet.</div>
              )}
              {filteredLists.map((list) => {
                const campaignStatus = listCampaignStatus(list, usageIndex);
                const manualMarked = (list.recipients || []).filter((recipient) => manualStatusFor(recipient) !== "unused").length;
                return (
                  <Card key={list.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">{list.name}</h2>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="mono text-[13px] text-emerald-500 dark:text-emerald-400">{list.recipients?.length || 0} recipients</p>
                          <StatusChip status={campaignStatus} />
                          {manualMarked > 0 && <span className="text-[11px] text-neutral-400 dark:text-zinc-500">{manualMarked} manually marked</span>}
                        </div>
                        <p className="mono mt-1 text-[11px] text-neutral-400 dark:text-zinc-500">{formatDateTime(list.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <Button variant="neutral" size="sm" onClick={() => markList(list, "used")} title="Mark whole list used"><UserCheck size={13} /></Button>
                        <Button variant="neutral" size="sm" onClick={() => markList(list, "sent")} title="Mark whole list sent"><Check size={13} /></Button>
                        <Button variant="neutral" size="sm" onClick={() => setViewing(list)} title="View numbers"><Eye size={13} /></Button>
                        <Button variant="neutral" size="sm" onClick={() => startEdit(list)} title="Edit list"><Pencil size={13} /></Button>
                        <Button variant="danger" size="sm" onClick={() => setDeleteTarget(list)} title="Delete list"><Trash2 size={13} /></Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <ListView
        list={viewing}
        lists={lists}
        copiedCount={copiedCount}
        setCopiedCount={setCopiedCount}
        defaultCountryCode={settings.defaultCountryCode}
        usageIndex={usageIndex}
        onClose={() => setViewing(null)}
        onUpdateRecipients={updateListRecipients}
        onAppendToList={appendToList}
        onCreateList={createListFromSelection}
      />
      <ListEdit editing={editing} copiedCount={copiedCount} defaultCountryCode={settings.defaultCountryCode} setEditing={setEditing} onSave={updateList} />
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

function ListView({ list, lists, copiedCount, setCopiedCount, defaultCountryCode, usageIndex, onClose, onUpdateRecipients, onAppendToList, onCreateList }) {
  const [selected, setSelected] = useState([]);
  const [moveTarget, setMoveTarget] = useState("");
  const [newListName, setNewListName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [editIndex, setEditIndex] = useState(null);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");

  useEffect(() => {
    setSelected([]);
    setMoveTarget("");
    setNewListName("");
    setPasteText("");
    setEditIndex(null);
  }, [list?.id]);

  if (!list) return null;

  const recipients = list.recipients || [];
  const selectedSet = new Set(selected);
  const selectedRecipients = recipients.filter((_, index) => selectedSet.has(index));
  const allSelected = recipients.length > 0 && selected.length === recipients.length;
  const pasteCheck = validateRecipients(parsePasteInput(pasteText), defaultCountryCode);

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

  return (
    <div className="fixed inset-0 z-300 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <p className="text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">{list.name}</p>
            <p className="mono mt-0.5 text-[11px] text-emerald-500 dark:text-emerald-400">{recipients.length} recipients / {selected.length} selected / {copiedCount} copied last</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-5 py-3 dark:border-zinc-800">
          <Button variant="neutral" size="sm" onClick={() => setSelected(allSelected ? [] : recipients.map((_, index) => index))}>
            {allSelected ? <Check size={13} /> : <Square size={13} />} {allSelected ? "Clear" : "All"}
          </Button>
          <Button variant="neutral" size="sm" onClick={() => setFirst(50)}>50</Button>
          <Button variant="neutral" size="sm" onClick={() => setFirst(100)}>100</Button>
          <Button variant="neutral" size="sm" onClick={() => copyRecipients(recipients.slice(0, 50))}><Clipboard size={13} /> Copy 50</Button>
          <Button variant="neutral" size="sm" onClick={() => copyRecipients(recipients.slice(0, 100))}><Clipboard size={13} /> Copy 100</Button>
          <Button variant="danger" size="sm" onClick={() => cutRecipients(recipients.slice(0, 50))}><Scissors size={13} /> Cut 50</Button>
          <Button variant="danger" size="sm" onClick={() => cutRecipients(recipients.slice(0, 100))}><Scissors size={13} /> Cut 100</Button>
          <Button variant="neutral" size="sm" onClick={() => copyRecipients()} disabled={!selected.length}><Clipboard size={13} /> Copy selected</Button>
          <Button variant="danger" size="sm" onClick={deleteSelected} disabled={!selected.length}><Trash2 size={13} /> Delete selected</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-5 py-3 dark:border-zinc-800">
          {["unused", "used", "sent", "failed", "skipped", "partial"].map((status) => (
            <Button key={status} variant="neutral" size="sm" onClick={() => markSelected(status)} disabled={!selected.length}>
              <UserCheck size={13} /> {statusLabels[status]}
            </Button>
          ))}
        </div>
        <div className="grid gap-2 border-b border-neutral-100 px-5 py-3 sm:grid-cols-[1fr_1fr_auto] dark:border-zinc-800">
          <select className="field h-10 px-3 text-[13px]" value={moveTarget} onChange={(event) => { setMoveTarget(event.target.value); setNewListName(""); }}>
            <option value="">Move to existing list...</option>
            {lists.filter((item) => item.id !== list.id).map((item) => (
              <option key={item.id} value={item.id}>{item.name} ({item.recipients?.length || 0})</option>
            ))}
          </select>
          <input className="field h-10 px-3 text-[13px]" value={newListName} onChange={(event) => { setNewListName(event.target.value); setMoveTarget(""); }} placeholder="Or new list name" />
          <Button onClick={moveSelected} disabled={!selected.length || (!moveTarget && !newListName.trim())}>
            <MoveRight size={14} /> Move
          </Button>
        </div>
        <div className="grid gap-2 border-b border-neutral-100 px-5 py-3 sm:grid-cols-[1fr_auto] dark:border-zinc-800">
          <textarea className="field mono min-h-20 p-3 text-[12px]" value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Paste more numbers into this list" />
          <div className="flex flex-col justify-between gap-2">
            <Button onClick={addPasted} disabled={!pasteCheck.valid.length}><Plus size={14} /> Add {pasteCheck.valid.length || ""}</Button>
            {pasteCheck.invalid.length > 0 && <span className="text-[11px] text-rose-500">{pasteCheck.invalid.length} invalid</span>}
          </div>
        </div>
        {editIndex !== null && (
          <div className="grid gap-2 border-b border-neutral-100 bg-neutral-50 px-5 py-3 sm:grid-cols-[1fr_1fr_auto_auto] dark:border-zinc-800 dark:bg-zinc-800/40">
            <input className="field h-10 px-3 text-[13px]" value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Name" />
            <input className="field h-10 px-3 text-[13px]" value={editNumber} onChange={(event) => setEditNumber(event.target.value)} placeholder="Number" />
            <Button onClick={saveRecipientEdit}><Check size={14} /> Save</Button>
            <Button variant="ghost" onClick={() => setEditIndex(null)}>Cancel</Button>
          </div>
        )}
        <div className="max-h-[46vh] overflow-auto p-5">
          {recipients.map((recipient, index) => {
            const campaignUsage = campaignStatusFor(recipient, usageIndex);
            const manualStatus = manualStatusFor(recipient);
            return (
              <div key={`${recipient.number}-${index}`} className="grid grid-cols-[34px_34px_minmax(0,1fr)_140px_170px_76px] items-center gap-3 border-b border-neutral-100 py-2.5 text-[13px] last:border-0 dark:border-zinc-800">
                <button type="button" onClick={() => toggle(index)} className={`grid h-7 w-7 place-items-center rounded-lg border transition ${selectedSet.has(index) ? "border-emerald-500 bg-emerald-500 text-white" : "border-neutral-200 text-neutral-400 hover:border-emerald-400 dark:border-zinc-700 dark:text-zinc-500"}`}>
                  {selectedSet.has(index) ? <Check size={14} /> : null}
                </button>
                <span className="mono text-neutral-300 dark:text-zinc-700">{index + 1}</span>
                <span className="truncate text-neutral-700 dark:text-zinc-300">{recipient.name || "No name"}</span>
                <span className="mono text-neutral-500 dark:text-zinc-400">{recipient.number}</span>
                <div className="flex flex-wrap gap-1.5">
                  <StatusChip status={campaignUsage.status} title={campaignUsage.error || campaignUsage.campaignName || ""} />
                  {manualStatus !== "unused" && <StatusChip status={manualStatus} title="Manual mark" />}
                </div>
                <Button variant="neutral" size="sm" onClick={() => startRecipientEdit(index)}><Pencil size={13} /> Edit</Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ListEdit({ editing, copiedCount, defaultCountryCode, setEditing, onSave }) {
  if (!editing.id) return null;
  const checked = validateRecipients(parsePasteInput(editing.text), defaultCountryCode);
  const limited = limitRecipients(checked.valid, editing.limit);
  return (
    <div className="fixed inset-0 z-300 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4">
          <p className="text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">Edit list</p>
          <p className="mt-1 text-[12px] text-neutral-500 dark:text-zinc-500">Update the saved audience name, recipients, and optional limit.</p>
        </div>
        <div className="flex flex-col gap-3">
          <input className="field h-10 px-3 text-[14px]" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value, error: "" })} />
          <textarea className="field mono p-3 text-[13px]" rows={10} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value, error: "" })} />
          <label className="text-[12px] text-neutral-500 dark:text-zinc-500">
            Limit
            <input className="field mt-1 h-10 w-full px-3 text-[13px]" value={editing.limit} onChange={(e) => setEditing({ ...editing, limit: e.target.value })} placeholder="Infinity" inputMode="numeric" />
          </label>
          <div className="flex flex-wrap gap-3 text-[12px]">
            <span className="text-emerald-500 dark:text-emerald-400">{limited.length} will save</span>
            {checked.valid.length !== limited.length && <span className="text-amber-500 dark:text-amber-400">{checked.valid.length - limited.length} over limit</span>}
            {checked.invalid.length > 0 && <span className="text-rose-400 dark:text-rose-400">{checked.invalid.length} invalid</span>}
            <span className="text-neutral-400 dark:text-zinc-500">{copiedCount} copied last</span>
          </div>
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
