"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Delete, ShieldCheck } from "lucide-react";

const PIN_LENGTH = 4;
const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export default function PinPad() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [expectedPin, setExpectedPin] = useState(process.env.NEXT_PUBLIC_APP_PIN || "1234");
  const [wrong, setWrong] = useState(false);

  const clearPin = useCallback(() => {
    setPin("");
    setWrong(false);
  }, []);

  const addDigit = useCallback((digit) => {
    setWrong(false);
    setPin((value) => value.length < PIN_LENGTH ? value + digit : value);
  }, []);

  const removeDigit = useCallback(() => {
    setWrong(false);
    setPin((value) => value.slice(0, -1));
  }, []);

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
    function handleKeyDown(event) {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        addDigit(event.key);
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        removeDigit();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        clearPin();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addDigit, clearPin, removeDigit]);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
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

  return (
    <main className="grid min-h-screen place-items-center bg-neutral-100 px-4 py-8 dark:bg-zinc-950">
      <section
        className={[
          "w-full max-w-[340px] rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl shadow-neutral-200/60",
          "dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20",
          wrong ? "shake" : "",
        ].join(" ")}
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-500 shadow-sm shadow-emerald-500/10 dark:text-emerald-400">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-neutral-950 dark:text-zinc-50">
              Enter PIN
            </h1>
          </div>
        </div>

        <div className="mb-4 flex justify-center gap-2" aria-label={`${pin.length} of ${PIN_LENGTH} PIN digits entered`}>
          {Array.from({ length: PIN_LENGTH }).map((_, index) => (
            <span
              key={index}
              className={[
                "h-2 w-7 rounded-full border transition-all",
                pin[index]
                  ? "border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-500/30"
                  : "border-neutral-200 bg-neutral-100 dark:border-zinc-700 dark:bg-zinc-800",
              ].join(" ")}
            />
          ))}
        </div>

        {wrong && (
          <div className="mb-3 flex h-5 items-center justify-center">
            <p className="text-[13px] font-semibold text-rose-500 dark:text-rose-400">Wrong PIN</p>
          </div>
        )}

        <div className="mx-auto grid w-full max-w-[252px] grid-cols-3 gap-2">
          {keys.map((key, index) => {
            const itemKey = `${key || "spacer"}-${index}`;
            if (!key) return <span key={itemKey} />;
            return (
              <button
                key={itemKey}
                type="button"
                onClick={() => key === "back" ? removeDigit() : addDigit(key)}
                className={[
                  "flex aspect-square w-full items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50",
                  "text-[18px] font-semibold text-neutral-900 shadow-sm shadow-neutral-200/40 transition",
                  "hover:border-emerald-500/40 hover:bg-emerald-50 hover:text-emerald-600 active:scale-[0.98]",
                  "dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:shadow-black/10",
                  "dark:hover:border-emerald-400/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400",
                ].join(" ")}
                aria-label={key === "back" ? "Delete last digit" : `Enter ${key}`}
              >
                {key === "back" ? <Delete size={20} /> : key}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
