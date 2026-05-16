"use client";

import { useEffect, useRef, useState } from "react";
import { File, FileArchive, FileImage, FileText, FileVideo, Save, Trash2, Upload } from "lucide-react";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";
import { Button, Section } from "./ui";

const ACCEPTED_ATTACHMENTS = [
  "image/*",
  "video/*",
  "application/pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".csv",
  ".txt",
  ".zip",
  ".rar",
].join(",");

export default function MessageComposer({ message, setMessage, images, setImages }) {
  const inputRef = useRef(null);
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => {
    loadTemplates();
  }, []);

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
    <Section title="Compose" eyebrow="Text, variants, and attachments" icon={FileImage}>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={8}
            className="field resize-y rounded-none p-4 text-base leading-7"
            placeholder="Write the message. Use {name} and {hi|hello|hey} variants."
          />
          <p className="mt-2 text-sm text-zinc-500">Use <span className="mono text-zinc-300">{"{name}"}</span> for personalization and <span className="mono text-zinc-300">{"{hi|hello|hey}"}</span> for random variants.</p>
        </div>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(event.dataTransfer.files);
            }}
            onDragOver={(event) => event.preventDefault()}
            className="flex min-h-36 w-full flex-col items-center justify-center border border-dashed border-zinc-700 bg-zinc-950 p-4 text-center transition hover:border-emerald-500/60"
          >
            <Upload className="mb-3 text-emerald-300" size={26} />
            <span className="text-sm font-bold text-zinc-200">Drop attachments or click to upload</span>
            <span className="text-xs text-zinc-500">Images, videos, PDF, Office files, text, CSV, ZIP</span>
          </button>
          <input ref={inputRef} type="file" accept={ACCEPTED_ATTACHMENTS} multiple hidden onChange={(event) => addFiles(event.target.files)} />

          {images.length ? (
            <div className="grid grid-cols-3 gap-2">
              {images.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative aspect-square overflow-hidden border border-zinc-800 bg-zinc-950">
                  <AttachmentPreview file={file} />
                  <button
                    type="button"
                    onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    className="absolute right-1 top-1 bg-black/70 p-1 text-rose-200"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid gap-2">
            <select className="field h-10 px-3" onChange={(event) => loadTemplate(event.target.value)} defaultValue="">
              <option value="">Load template</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
            <div className="flex gap-2">
              <input className="field h-10 px-3" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" />
              <Button variant="neutral" onClick={saveTemplate}><Save size={16} /></Button>
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
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/zip",
      "application/x-zip-compressed",
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

  const Icon = file.type.startsWith("video/")
    ? FileVideo
    : file.type.includes("zip") || file.name.toLowerCase().endsWith(".rar")
      ? FileArchive
      : file.type.includes("pdf") || /\.(docx?|xlsx?|pptx?|csv|txt|pdf)$/i.test(file.name)
        ? FileText
        : File;

  return (
    <div className="flex h-full flex-col items-center justify-center p-3 text-center">
      <Icon className="mb-2 text-emerald-300" size={28} />
      <span className="line-clamp-2 break-all text-xs font-bold text-zinc-200">{file.name}</span>
      <span className="mono mt-1 text-[10px] text-zinc-500">{Math.ceil(file.size / 1024)} KB</span>
    </div>
  );
}
