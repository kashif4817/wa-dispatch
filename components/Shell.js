"use client";

import Sidebar from "./Sidebar";

export default function Shell({ children, noPadding = false }) {
  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-zinc-950">
      {/* Sidebar is overflow-visible so tooltips render outside its bounds */}
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <main className={`flex-1 overflow-auto${noPadding ? "" : " p-6 lg:p-8"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
