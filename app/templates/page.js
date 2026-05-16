"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Nav from "@/components/Nav";
import { Button } from "@/components/ui";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!hasSupabaseConfig()) return;
    const { data } = await getSupabase().from("templates").select("*").order("created_at", { ascending: false });
    setTemplates(data || []);
  }

  useEffect(() => { load(); }, []);

  async function createTemplate() {
    if (!name.trim()) return;
    await getSupabase().from("templates").insert({ name: name.trim(), message_text: message, image_paths: [] });
    setName("");
    setMessage("");
    load();
  }

  async function remove(id) {
    await getSupabase().from("templates").delete().eq("id", id);
    load();
  }

  return (
    <>
      <Nav />
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[420px_1fr]">
        <section className="control-card rounded-lg p-5">
          <p className="mono text-[11px] uppercase tracking-wider text-zinc-500">Reusable copy</p>
          <h1 className="mb-4 text-xl font-black">New Template</h1>
          <input className="field mb-3 h-11 px-3" value={name} onChange={(event) => setName(event.target.value)} placeholder="Template name" />
          <textarea className="field mb-3 p-3" rows={9} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message text" />
          <Button onClick={createTemplate}><Plus size={16} /> Save template</Button>
        </section>

        <section className="grid gap-3">
          {templates.map((template) => (
            <article key={template.id} className="control-card rounded-lg p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-black">{template.name}</h2>
                  <p className="mono text-xs text-zinc-500">{new Date(template.created_at).toLocaleString()}</p>
                </div>
                <Button variant="danger" onClick={() => remove(template.id)}><Trash2 size={16} /></Button>
              </div>
              <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{template.message_text}</p>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
