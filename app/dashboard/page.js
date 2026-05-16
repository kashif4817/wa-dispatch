"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import ConnectionPanel from "@/components/ConnectionPanel";
import MessageComposer from "@/components/MessageComposer";
import RecipientsInput from "@/components/RecipientsInput";
import SendPanel from "@/components/SendPanel";
import ProgressView from "@/components/ProgressView";
import { useCampaignSettings } from "@/lib/settings";

export default function DashboardPage() {
  const router = useRouter();
  const [connection, setConnection] = useState({ status: "disconnected" });
  const [message, setMessage] = useState("");
  const [images, setImages] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [running, setRunning] = useState(false);
  const { settings } = useCampaignSettings();

  useEffect(() => {
    if (localStorage.getItem("wa_sender_unlocked") !== "true") router.replace("/");
  }, [router]);

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5">
        <ConnectionPanel onStatus={setConnection} />
        <MessageComposer message={message} setMessage={setMessage} images={images} setImages={setImages} />
        <RecipientsInput recipients={recipients} setRecipients={setRecipients} defaultCountryCode={settings.defaultCountryCode} />
        {running ? (
          <ProgressView onDone={() => setRunning(false)} />
        ) : (
          <SendPanel
            connected={connection.status === "connected"}
            recipients={recipients}
            message={message}
            images={images}
            onStarted={() => setRunning(true)}
          />
        )}
      </main>
    </>
  );
}
