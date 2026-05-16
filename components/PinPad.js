"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Delete, ShieldCheck } from "lucide-react";

export default function PinPad() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [expectedPin, setExpectedPin] = useState(process.env.NEXT_PUBLIC_APP_PIN || "1234");
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("wa_sender_unlocked") === "true") router.replace("/dashboard");
    fetch("/api/pin")
      .then((response) => response.json())
      .then((data) => {
        if (data.pin) setExpectedPin(data.pin);
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (pin.length !== 4) return;
    if (pin === expectedPin) {
      localStorage.setItem("wa_sender_unlocked", "true");
      router.push("/dashboard");
    } else {
      setWrong(true);
      setTimeout(() => {
        setPin("");
        setWrong(false);
      }, 450);
    }
  }, [pin, router, expectedPin]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className={`control-card w-full max-w-sm rounded-lg p-6 ${wrong ? "shake" : ""}`}>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="mono text-[11px] uppercase tracking-wider text-zinc-500">Client-side local gate</p>
            <h1 className="text-2xl font-black">Enter PIN</h1>
          </div>
        </div>

        <div className="mb-4 flex justify-center gap-3">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className={`h-3 w-10 border ${pin[index] ? "border-emerald-400 bg-emerald-400" : "border-zinc-700 bg-zinc-950"}`} />
          ))}
        </div>
        {wrong ? <p className="mb-3 text-center text-sm font-bold text-rose-300">Wrong PIN</p> : <p className="mb-3 text-center text-sm text-zinc-500">Unlock campaign console</p>}

        <div className="grid grid-cols-3 gap-2">
          {keys.map((key, index) => {
            const itemKey = `${key || "spacer"}-${index}`;
            if (!key) return <span key={itemKey} />;
            return (
              <button
                key={itemKey}
                onClick={() => key === "back" ? setPin((value) => value.slice(0, -1)) : setPin((value) => value.length < 4 ? value + key : value)}
                className="flex h-16 items-center justify-center border border-zinc-800 bg-zinc-950 text-xl font-black text-zinc-100 transition hover:border-emerald-500/50 hover:bg-zinc-900"
              >
                {key === "back" ? <Delete size={22} /> : key}
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
