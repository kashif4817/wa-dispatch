"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, RadioTower } from "lucide-react";
import Shell from "@/components/Shell";
import MessageComposer from "@/components/MessageComposer";
import RecipientsInput from "@/components/RecipientsInput";
import SendPanel from "@/components/SendPanel";
import ProgressView from "@/components/ProgressView";
import { useCampaignSettings } from "@/lib/settings";

export default function NewCampaignPage() {
  const router = useRouter();
  const [message, setMessage]       = useState("");
  const [images, setImages]         = useState([]);
  const [selectedImagePaths, setSelectedImagePaths] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [running, setRunning]       = useState(false);
  const [connected, setConnected]   = useState(false);
  const { settings } = useCampaignSettings();

  useEffect(() => {
    if (localStorage.getItem("wa_sender_unlocked") !== "true") router.replace("/");
  }, [router]);

  useEffect(() => {
    async function check() {
      try {
        const data = await fetch("/api/status").then(r => r.json());
        setConnected(data.status === "connected");
      } catch { setConnected(false); }
    }
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-1 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">New Campaign</span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
          <Link
            href="/dashboard"
            className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700"
          >
            <LayoutDashboard size={13} /> Dashboard
          </Link>
          <Link
            href="/progress"
            className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700"
          >
            <RadioTower size={13} /> Live Progress
          </Link>
          <div className="ml-auto flex items-center gap-1.5 text-[12px]">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-rose-500"}`} />
            <span className={connected ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}>
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="flex flex-col gap-5">
        <MessageComposer
          message={message}
          setMessage={setMessage}
          images={images}
          setImages={setImages}
          selectedImagePaths={selectedImagePaths}
          setSelectedImagePaths={setSelectedImagePaths}
        />
        <RecipientsInput
          recipients={recipients}
          setRecipients={setRecipients}
          defaultCountryCode={settings.defaultCountryCode}
        />
        {running ? (
          <ProgressView onDone={() => { setRunning(false); router.push("/dashboard"); }} />
        ) : (
          <SendPanel
            connected={connected}
            recipients={recipients}
            message={message}
            images={images}
            selectedImagePaths={selectedImagePaths}
            onStarted={() => setRunning(true)}
          />
        )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
