"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Nav from "@/components/Nav";
import { Button } from "@/components/ui";
import { parsePasteInput, validateRecipients } from "@/lib/parsers";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

export default function ListsPage() {
  const [lists, setLists] = useState([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");

  async function load() {
    if (!hasSupabaseConfig()) return;
    const { data } = await getSupabase().from("recipient_lists").select("*").order("created_at", { ascending: false });
    setLists(data || []);
  }

  useEffect(() => { load(); }, []);

  async function createList() {
    const { valid } = validateRecipients(parsePasteInput(text), "92");
    if (!name.trim() || !valid.length) return;
    await getSupabase().from("recipient_lists").insert({ name: name.trim(), recipients: valid });
    setName("");
    setText("");
    load();
  }

  async function remove(id) {
    await getSupabase().from("recipient_lists").delete().eq("id", id);
    load();
  }

  return (
    <>
      <Nav />
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[420px_1fr]">
        <section className="control-card rounded-lg p-5">
          <p className="mono text-[11px] uppercase tracking-wider text-zinc-500">Saved audiences</p>
          <h1 className="mb-4 text-xl font-black">New List</h1>
          <input className="field mb-3 h-11 px-3" value={name} onChange={(event) => setName(event.target.value)} placeholder="List name" />
          <textarea className="field mb-3 p-3 mono text-sm" rows={10} value={text} onChange={(event) => setText(event.target.value)} placeholder="One number per line" />
          <Button onClick={createList}><Plus size={16} /> Save list</Button>
        </section>

        <section className="grid gap-3">
          {lists.map((list) => (
            <article key={list.id} className="control-card rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-black">{list.name}</h2>
                  <p className="mono text-sm text-zinc-400">{list.recipients?.length || 0} recipients</p>
                  <p className="mono text-xs text-zinc-500">{new Date(list.created_at).toLocaleString()}</p>
                </div>
                <Button variant="danger" onClick={() => remove(list.id)}><Trash2 size={16} /></Button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
