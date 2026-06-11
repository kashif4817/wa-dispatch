"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { File, FileArchive, FileImage, FileText, FileVideo, Images, Save, Trash2, Upload } from "lucide-react";
import { getPublicUrl, getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { Button, Section } from "./ui";

const ACCEPTED_ATTACHMENTS = [
  "image/*", "video/*", "application/pdf",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".csv", ".txt", ".zip", ".rar",
].join(",");

export default function MessageComposer({ message, setMessage, images, setImages, selectedImagePaths = [], setSelectedImagePaths }) {
  const inputRef = useRef(null);
  const [templates, setTemplates] = useState([]);
  const [ads, setAds] = useState([]);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => {
    loadTemplates();
    loadAds();
  }, []);

  async function loadTemplates() {
    if (!hasSupabaseConfig()) return;
    const { data } = await getSupabase().from("templates").select("*").order("created_at", { ascending: false });
    setTemplates(data || []);
  }

  async function loadAds() {
    if (!hasSupabaseConfig()) return;
    const { data } = await getSupabase().storage.from("campaign-images").list("ads", {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
    setAds((data || []).filter((item) => item.name && !item.name.endsWith("/")));
  }

  function addFiles(files) {
    setImages((current) => [...current, ...Array.from(files).filter(isSupportedAttachment)]);
  }

  async function saveTemplate() {
    if (!templateName.trim() || !hasSupabaseConfig()) return;
    await getSupabase().from("templates").insert({ name: templateName.trim(), message_text: message, image_paths: [] });
    setTemplateName("");
    loadTemplates();
  }

  function loadTemplate(id) {
    const template = templates.find((item) => item.id === id);
    if (template) setMessage(template.message_text || "");
  }

  function addAd(path) {
    if (!path || !setSelectedImagePaths) return;
    setSelectedImagePaths((current) => current.includes(path) ? current : [...current, path]);
  }

  return (
    <Section title="Compose Message" eyebrow="Text, variants, and attachments" icon={FileImage}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={13}
            className="field min-h-[420px] resize-y p-4 text-[14px] leading-7"
            placeholder="Write your campaign message here..."
          />
        </div>

        <div className="flex flex-col gap-4">
          {/* Drop zone */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            onDragOver={(e) => e.preventDefault()}
            className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center transition hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-zinc-700 dark:bg-zinc-800/40 dark:hover:border-emerald-500/60 dark:hover:bg-emerald-500/5"
          >
            <Upload className="mb-2 text-emerald-500" size={22} />
            <span className="text-[13px] font-medium text-neutral-700 dark:text-zinc-300">Drop files or click to upload</span>
            <span className="mt-0.5 text-[11px] text-neutral-400 dark:text-zinc-500">Images, videos, PDF, Office, CSV, ZIP</span>
          </button>
          <input ref={inputRef} type="file" accept={ACCEPTED_ATTACHMENTS} multiple hidden onChange={(e) => addFiles(e.target.files)} />

          {/* Attachment thumbnails */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800">
                  <AttachmentPreview file={file} />
                  <button
                    type="button"
                    onClick={() => setImages((cur) => cur.filter((_, i) => i !== index))}
                    className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedImagePaths.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {selectedImagePaths.map((path) => (
                <div key={path} className="relative aspect-square overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <SavedAttachmentPreview path={path} />
                  <button
                    type="button"
                    onClick={() => setSelectedImagePaths?.((cur) => cur.filter((item) => item !== path))}
                    className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Template controls */}
          <div className="flex flex-col gap-2">
            <select
              className="field h-10 px-3 text-[13px]"
              onChange={(e) => loadTemplate(e.target.value)}
              defaultValue=""
            >
              <option value="">Load template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="flex gap-2">
              <input
                className="field h-10 flex-1 px-3 text-[13px]"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
              />
              <Button variant="neutral" size="md" onClick={saveTemplate}>
                <Save size={14} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3 dark:border-zinc-800">
            <select
              className="field h-10 px-3 text-[13px]"
              onChange={(e) => { addAd(e.target.value); e.target.value = ""; }}
              defaultValue=""
            >
              <option value="">Load saved ad...</option>
              {ads.map((ad) => {
                const path = `ads/${ad.name}`;
                return <option key={path} value={path}>{ad.name}</option>;
              })}
            </select>
            <Link
              href="/ads"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-[14px] font-medium text-neutral-700 transition-all duration-200 hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <Images size={14} /> Manage Ads
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}

function SavedAttachmentPreview({ path }) {
  const name = path.split("/").pop() || "attachment";
  const url = getPublicUrl("campaign-images", path);
  if (/\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(name)) {
    return <img src={url} alt="" className="h-full w-full object-cover" />;
  }
  const Icon = /\.(mp4|mov|webm|mkv)$/i.test(name) ? FileVideo
    : /\.(zip|rar)$/i.test(name) ? FileArchive
    : /\.(pdf|docx?|xlsx?|pptx?|csv|txt)$/i.test(name) ? FileText
    : File;

  return (
    <div className="flex h-full flex-col items-center justify-center p-2 text-center">
      <Icon className="mb-1 text-emerald-500" size={22} />
      <span className="line-clamp-2 break-all text-[10px] font-medium text-neutral-600 dark:text-zinc-300">{name}</span>
      <span className="mt-0.5 text-[9px] text-emerald-500">Saved ad</span>
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

function AttachmentPreview({ file }) {
  const objectUrl = useMemo(() => (
    file.type.startsWith("image/") ? URL.createObjectURL(file) : ""
  ), [file]);

  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  if (file.type.startsWith("image/")) {
    return <img src={objectUrl} alt="" className="h-full w-full object-cover" />;
  }
  const Icon = file.type.startsWith("video/") ? FileVideo
    : file.type.includes("zip") || file.name.toLowerCase().endsWith(".rar") ? FileArchive
    : file.type.includes("pdf") || /\.(docx?|xlsx?|pptx?|csv|txt|pdf)$/i.test(file.name) ? FileText
    : File;

  return (
    <div className="flex h-full flex-col items-center justify-center p-2 text-center">
      <Icon className="mb-1 text-emerald-500" size={22} />
      <span className="line-clamp-2 break-all text-[10px] font-medium text-neutral-600 dark:text-zinc-300">{file.name}</span>
      <span className="mono mt-0.5 text-[9px] text-neutral-400">{Math.ceil(file.size / 1024)} KB</span>
    </div>
  );
}
