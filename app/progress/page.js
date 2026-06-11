"use client";

import Link from "next/link";
import { History, RadioTower } from "lucide-react";
import Shell from "@/components/Shell";
import ProgressView from "@/components/ProgressView";

export default function ProgressPage() {
  return (
    <Shell noPadding>
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950">
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="mr-1 flex items-center gap-1.5 text-[14px] font-semibold text-neutral-800 dark:text-zinc-100">
            <RadioTower size={14} /> Live Progress
          </span>
          <div className="mr-1 h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
          <Link href="/history" className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-600 shadow-sm shadow-neutral-200/40 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-black/10 dark:hover:bg-zinc-700">
            <History size={13} /> History
          </Link>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <ProgressView />
        </div>
      </div>
    </Shell>
  );
}
