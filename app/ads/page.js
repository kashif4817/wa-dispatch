"use client";

import { useEffect, useRef, useState } from "react";
import { File, FileArchive, FileImage, FileText, FileVideo, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import Shell from "@/components/Shell";
import { Button, ConfirmDialog, SkeletonBlock } from "@/components/ui";
import { formatDateTime } from "@/lib/dateFormat";
import { getPublicUrl, getSupabase, hasSupabaseConfig } from "@/lib/supabase";

const BUCKET = "campaign-images";
const ADS_FOLDER = "ads";
const ACCEPTED_ATTACHMENTS = [
  "image/*", "video/*", "application/pdf",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".csv", ".txt", ".zip", ".rar",
].join(",");

export default function AdsPage() {
  const inputRef = useRef(null);
  const [ads, setAds] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!hasSupabaseConfig()) {
      setLoading(false);
      return;
    }
    try {
      const { data, error: listError } = await getSupabase().storage.from(BUCKET).list(ADS_FOLDER, {
        limit: 200,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (listError) {
        setError(listError.message);
        return;
      }
      setError("");
      setAds((data || []).filter((item) => item.name && !item.name.endsWith("/")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function upload(files) {
    const selected = Array.from(files || []).filter(isSupportedAttachment);
    if (!selected.length || !hasSupabaseConfig()) return;
    setUploading(true);
    setError("");
    try {
      const supabase = getSupabase();
      for (const file of selected) {
        const safeName = file.name.replace(/[^\w.-]/g, "_");
        const path = `${ADS_FOLDER}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (uploadError) throw uploadError;
      }
      await load();
      setShowUpload(false);
    } catch (uploadError) {
      setError(uploadError.message || "Could not upload ad.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeAd() {
    if (!deleteTarget) return;
    const path = `${ADS_FOLDER}/${deleteTarget.name}`;
    const { error: removeError } = await getSupabase().storage.from(BUCKET).remove([path]);
    if (removeError) setError(removeError.message);
    setDeleteTarget(null);
    load();
  }

  function openEdit(ad) {
    setEditTarget(ad);
    setEditName(ad.name);
    setError("");
  }

  async function saveEdit() {
    if (!editTarget || savingEdit) return;
    const nextName = normalizeAdName(editName, editTarget.name);
    if (!nextName) {
      setError("Enter a valid file name.");
      return;
    }
    if (nextName === editTarget.name) {
      setEditTarget(null);
      return;
    }
    if (ads.some((ad) => ad.name.toLowerCase() === nextName.toLowerCase())) {
      setError("An ad with that name already exists.");
      return;
    }

    setSavingEdit(true);
    setError("");
    const fromPath = `${ADS_FOLDER}/${editTarget.name}`;
    const toPath = `${ADS_FOLDER}/${nextName}`;
    const { error: moveError } = await getSupabase().storage.from(BUCKET).move(fromPath, toPath);
    setSavingEdit(false);
    if (moveError) {
      setError(moveError.message);
      return;
    }
    setEditTarget(null);
    setEditName("");
    load();
  }

  const filteredAds = ads.filter((ad) => ad.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-2 shrink-0 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">Ads Gallery</span>
          <div className="flex h-9 flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm shadow-neutral-200/40 dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-black/10">
            <Search size={14} className="shrink-0 text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ads..."
              className="w-full bg-transparent text-[12px] text-neutral-700 placeholder-neutral-400 outline-none dark:text-zinc-200 dark:placeholder-zinc-500"
            />
          </div>
          <Button size="sm" onClick={() => { setError(""); setShowUpload(true); }}>
            <Plus size={14} /> Add Ad
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="grid gap-5">
            <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {loading && <AdGridSkeleton />}
              {!loading && filteredAds.length === 0 && (
                <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-neutral-200 text-[14px] text-neutral-400 dark:border-zinc-700 dark:text-zinc-600 sm:col-span-2 xl:col-span-4">
                  No saved ads yet.
                </div>
              )}
              {!loading && filteredAds.map((ad) => (
                <AdCard
                  key={ad.id || ad.name}
                  ad={ad}
                  onDelete={() => setDeleteTarget(ad)}
                  onEdit={() => openEdit(ad)}
                  onView={() => setViewTarget(ad)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <AdUploadDialog
        open={showUpload}
        inputRef={inputRef}
        uploading={uploading}
        error={error}
        onUpload={upload}
        onClose={() => { setShowUpload(false); setError(""); }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete ad?"
        description={deleteTarget ? `This will permanently delete "${deleteTarget.name}" from the bucket.` : ""}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeAd}
      />
      <EditAdDialog
        open={!!editTarget}
        ad={editTarget}
        value={editName}
        error={error}
        saving={savingEdit}
        onChange={setEditName}
        onCancel={() => { setEditTarget(null); setEditName(""); setError(""); }}
        onConfirm={saveEdit}
      />
      <AdViewDialog ad={viewTarget} onClose={() => setViewTarget(null)} />
    </Shell>
  );
}

function AdUploadDialog({ open, inputRef, uploading, error, onUpload, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-300 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200/80 bg-neutral-50 text-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-emerald-400">
              <FileImage size={17} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">Add ad</p>
              <p className="mt-1 text-[12px] text-neutral-500 dark:text-zinc-500">Upload media or files for campaign attachments.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={(event) => { event.preventDefault(); onUpload(event.dataTransfer.files); }}
          onDragOver={(event) => event.preventDefault()}
          className="flex min-h-48 w-full flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center transition hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-zinc-700 dark:bg-zinc-800/40 dark:hover:border-emerald-500/60 dark:hover:bg-emerald-500/5"
        >
          <Upload className="mb-2 text-emerald-500" size={24} />
          <span className="text-[13px] font-medium text-neutral-700 dark:text-zinc-300">
            {uploading ? "Uploading..." : "Drop files or click to upload"}
          </span>
          <span className="mt-0.5 text-[11px] text-neutral-400 dark:text-zinc-500">Images, videos, PDF, Office, CSV, ZIP</span>
        </button>
        <input ref={inputRef} type="file" accept={ACCEPTED_ATTACHMENTS} multiple hidden onChange={(event) => onUpload(event.target.files)} />
        {error && <p className="mt-3 text-[13px] font-medium text-rose-500 dark:text-rose-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={uploading} onClick={() => inputRef.current?.click()}>
            <Plus size={15} /> Add Files
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdGridSkeleton() {
  return Array.from({ length: 8 }).map((_, index) => (
    <div key={index} className="overflow-hidden rounded-2xl border border-neutral-200/60 bg-white/80 shadow-sm shadow-neutral-200/40 dark:border-zinc-800/60 dark:bg-zinc-900/80 dark:shadow-black/10">
      <SkeletonBlock className="aspect-square rounded-none" />
      <div className="p-3">
        <SkeletonBlock className="h-4 w-3/4 rounded-lg" />
        <SkeletonBlock className="mt-2 h-3 w-1/2 rounded-lg" />
        <div className="mt-3 flex gap-2">
          <SkeletonBlock className="h-8 flex-1" />
          <SkeletonBlock className="h-8 w-9" />
          <SkeletonBlock className="h-8 w-9" />
        </div>
      </div>
    </div>
  ));
}

function AdCard({ ad, onDelete, onEdit, onView }) {
  const path = `${ADS_FOLDER}/${ad.name}`;
  const url = getPublicUrl(BUCKET, path);
  const size = ad.metadata?.size ? `${Math.ceil(ad.metadata.size / 1024)} KB` : "";

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/60 bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/80">
      <div className="aspect-square bg-neutral-50 dark:bg-zinc-800">
        <StoredPreview name={ad.name} url={url} />
      </div>
      <div className="p-3">
        <div className="mb-3 min-w-0">
          <p className="truncate text-[13px] font-semibold text-neutral-900 dark:text-zinc-50">{ad.name}</p>
          <p className="mono mt-0.5 truncate text-[10px] text-neutral-400 dark:text-zinc-500">
            {formatDateTime(ad.created_at || ad.updated_at)} {size ? `- ${size}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onView}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            View
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            aria-label={`Edit ${ad.name}`}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-8 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EditAdDialog({ open, ad, value, error, saving, onChange, onCancel, onConfirm }) {
  if (!open || !ad) return null;

  return (
    <div className="fixed inset-0 z-300 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40">
        <div className="mb-5">
          <p className="text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">Edit ad name</p>
          <p className="mt-1.5 text-[13px] leading-5 text-neutral-500 dark:text-zinc-400">
            Rename this saved ad in the bucket. Keep the extension so campaign previews still know the file type.
          </p>
        </div>
        <label className="mb-2 block text-[12px] font-semibold text-neutral-500 dark:text-zinc-400" htmlFor="ad-name">
          File name
        </label>
        <input
          id="ad-name"
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onConfirm();
            if (event.key === "Escape") onCancel();
          }}
          className="field h-10 w-full px-3 text-[13px]"
          placeholder={ad.name}
        />
        {error && <p className="mt-3 text-[13px] font-medium text-rose-500 dark:text-rose-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className="h-9 rounded-xl border border-emerald-500/30 bg-emerald-500 px-3 text-[13px] font-semibold text-white shadow-sm shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdViewDialog({ ad, onClose }) {
  if (!ad) return null;
  const path = `${ADS_FOLDER}/${ad.name}`;
  const url = getPublicUrl(BUCKET, path);
  const isImage = isImageName(ad.name);

  return (
    <div className="fixed inset-0 z-300 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-black/20 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 dark:border-zinc-800">
          <FileImage className="shrink-0 text-emerald-500" size={17} />
          <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-neutral-900 dark:text-zinc-50">{ad.name}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            aria-label="Close preview"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex min-h-80 flex-1 items-center justify-center overflow-auto bg-neutral-50 p-4 dark:bg-zinc-950">
          {isImage ? (
            <img src={url} alt={ad.name} className="max-h-[72vh] max-w-full rounded-xl object-contain" />
          ) : (
            <div className="w-full max-w-sm text-center">
              <StoredPreview name={ad.name} url={url} />
              <p className="mt-4 text-[13px] text-neutral-500 dark:text-zinc-400">
                Preview is available for image ads. This file can still be selected for campaigns.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StoredPreview({ name, url }) {
  if (isImageName(name)) {
    return <img src={url} alt="" className="h-full w-full object-cover" />;
  }
  const Icon = /\.(mp4|mov|webm|mkv)$/i.test(name) ? FileVideo
    : /\.(zip|rar)$/i.test(name) ? FileArchive
    : /\.(pdf|docx?|xlsx?|pptx?|csv|txt)$/i.test(name) ? FileText
    : File;

  return (
    <div className="flex h-full flex-col items-center justify-center p-4 text-center">
      <Icon className="mb-2 text-emerald-500" size={28} />
      <span className="line-clamp-2 break-all text-[12px] font-medium text-neutral-600 dark:text-zinc-300">{name}</span>
    </div>
  );
}

function isImageName(name) {
  return /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(name);
}

function normalizeAdName(value, currentName) {
  const cleaned = value.trim().replace(/[\\/]/g, "-").replace(/[^\w.\- ()]/g, "_");
  if (!cleaned || cleaned === "." || cleaned === "..") return "";
  if (/\.[A-Za-z0-9]{1,8}$/.test(cleaned)) return cleaned;
  const extension = currentName.match(/(\.[A-Za-z0-9]{1,8})$/)?.[1] || "";
  return `${cleaned}${extension}`;
}

function isSupportedAttachment(file) {
  const name = file.name.toLowerCase();
  return file.type.startsWith("image/")
    || file.type.startsWith("video/")
    || [
      "application/pdf", "text/plain", "text/csv",
      "application/zip", "application/x-zip-compressed",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ].includes(file.type)
    || /\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar)$/i.test(name);
}
