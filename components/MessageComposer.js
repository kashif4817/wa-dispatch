"use client";

import { useEffect, useRef, useState } from "react";
import { File, FileArchive, FileImage, FileText, FileVideo, Save, Trash2, Upload } from "lucide-react";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { Button, Section } from "./ui";

const ACCEPTED_ATTACHMENTS = [
  "image/*", "video/*", "application/pdf",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".csv", ".txt", ".zip", ".rar",
].join(",");

export default function MessageComposer({ message, setMessage, images, setImages }) {
  const inputRef = useRef(null);
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    if (!hasSupabaseConfig()) return;
    const { data } = await getSupabase().from("templates").select("*").order("created_at", { ascending: false });
    setTemplates(data || []);
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

  return (
    <Section title="Compose Message" eyebrow="Text, variants, and attachments" icon={FileImage}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={9}
            className="field resize-y p-4 text-[14px] leading-7"
            placeholder="Write the message. Use {name} and {hi|hello|hey} variants."
          />
          <p className="mt-2 text-[12px] text-neutral-400 dark:text-zinc-500">
            Use <span className="mono text-neutral-600 dark:text-zinc-300">{"{name}"}</span> for personalization and{" "}
            <span className="mono text-neutral-600 dark:text-zinc-300">{"{hi|hello|hey}"}</span> for random variants.
          </p>
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
        </div>
      </div>
    </Section>
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
  if (file.type.startsWith("image/")) {
    return <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />;
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
