"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { File, FileArchive, FileImage, FileText, FileVideo, Plus, RefreshCw, Search, Send, Trash2, Upload } from "lucide-react";
import Shell from "@/components/Shell";
import { Button, ConfirmDialog, Section } from "@/components/ui";
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

  async function load() {
    if (!hasSupabaseConfig()) return;
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

  const filteredAds = ads.filter((ad) => ad.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-1 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">Ads Gallery</span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
          <Link
            href="/campaign/new"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-emerald-500/25 transition hover:bg-emerald-400"
          >
            <Send size={14} /> New Campaign
          </Link>
          <button
            onClick={load}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <div className="ml-2 flex h-9 flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm shadow-neutral-200/40 dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-black/10">
            <Search size={14} className="shrink-0 text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ads..."
              className="w-full bg-transparent text-[12px] text-neutral-700 placeholder-neutral-400 outline-none dark:text-zinc-200 dark:placeholder-zinc-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <Section title="Add Ads" eyebrow="Bucket gallery" icon={FileImage}>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDrop={(event) => { event.preventDefault(); upload(event.dataTransfer.files); }}
                onDragOver={(event) => event.preventDefault()}
                className="flex min-h-48 w-full flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center transition hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-zinc-700 dark:bg-zinc-800/40 dark:hover:border-emerald-500/60 dark:hover:bg-emerald-500/5"
              >
                <Upload className="mb-2 text-emerald-500" size={24} />
                <span className="text-[13px] font-medium text-neutral-700 dark:text-zinc-300">
                  {uploading ? "Uploading..." : "Drop files or click to upload"}
                </span>
                <span className="mt-0.5 text-[11px] text-neutral-400 dark:text-zinc-500">Images, videos, PDF, Office, CSV, ZIP</span>
              </button>
              <input ref={inputRef} type="file" accept={ACCEPTED_ATTACHMENTS} multiple hidden onChange={(event) => upload(event.target.files)} />
              {error && <p className="mt-3 text-[13px] font-medium text-rose-500 dark:text-rose-400">{error}</p>}
              <Button className="mt-4 w-full" disabled={uploading} onClick={() => inputRef.current?.click()}>
                <Plus size={15} /> Add Files
              </Button>
            </Section>

            <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {filteredAds.length === 0 && (
                <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-neutral-200 text-[14px] text-neutral-400 dark:border-zinc-700 dark:text-zinc-600 sm:col-span-2 xl:col-span-4">
                  No saved ads yet.
                </div>
              )}
              {filteredAds.map((ad) => (
                <AdCard key={ad.id || ad.name} ad={ad} onDelete={() => setDeleteTarget(ad)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete ad?"
        description={deleteTarget ? `This will permanently delete "${deleteTarget.name}" from the bucket.` : ""}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeAd}
      />
    </Shell>
  );
}

function AdCard({ ad, onDelete }) {
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
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 flex-1 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            View
          </a>
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

function StoredPreview({ name, url }) {
  if (/\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(name)) {
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
