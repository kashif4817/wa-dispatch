"use client";

export function Button({ className = "", variant = "primary", size = "md", ...props }) {
  const base = "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-emerald-500 text-white hover:bg-emerald-400 border border-emerald-500/60 shadow-sm shadow-emerald-500/20",
    neutral: [
      "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
      "dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
    ].join(" "),
    danger: [
      "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100",
      "dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20",
    ].join(" "),
    ghost: [
      "border border-transparent text-neutral-600 hover:bg-neutral-100",
      "dark:text-zinc-400 dark:hover:bg-zinc-800",
    ].join(" "),
  };

  const sizes = {
    sm: "h-8 px-3 text-[13px] gap-1.5",
    md: "h-10 px-4 text-[14px] gap-2",
    lg: "h-11 px-5 text-[15px] gap-2",
  };

  return (
    <button
      {...props}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    />
  );
}

export function Section({ title, eyebrow, icon: Icon, children, aside, className = "" }) {
  return (
    <div className={[
      "overflow-visible rounded-2xl border border-neutral-200/60 bg-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] backdrop-blur-xl",
      "transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)]",
      "dark:border-zinc-800/60 dark:bg-zinc-900/80 dark:shadow-[0_4px_20px_rgba(0,0,0,0.25)]",
      className,
    ].join(" ")}>
      <div className="flex flex-col gap-3 border-b border-neutral-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200/80 bg-neutral-50 text-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-emerald-400">
              <Icon size={17} />
            </div>
          )}
          <div>
            {eyebrow && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-600">
                {eyebrow}
              </p>
            )}
            <h2 className="text-[16px] font-semibold tracking-tight text-neutral-900 dark:text-zinc-50">
              {title}
            </h2>
          </div>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function Card({ className = "", children, ...props }) {
  return (
    <div
      {...props}
      className={[
        "rounded-2xl border border-neutral-200/60 bg-white/80 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] backdrop-blur-xl",
        "transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_8px_28px_rgba(0,0,0,0.06)]",
        "dark:border-zinc-800/60 dark:bg-zinc-900/80 dark:shadow-[0_4px_20px_rgba(0,0,0,0.25)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, tone = "neutral" }) {
  const tones = {
    emerald: "text-emerald-500 dark:text-emerald-400",
    rose: "text-rose-500 dark:text-rose-400",
    amber: "text-amber-500 dark:text-amber-400",
    neutral: "text-neutral-900 dark:text-zinc-100",
  };

  return (
    <div className="rounded-xl border border-neutral-200/60 bg-neutral-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-zinc-500">{label}</p>
      <p className={`mono mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

export function StatusDot({ tone = "zinc", pulse = false }) {
  const colors = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    zinc: "bg-zinc-400",
  };
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${colors[tone]} ${pulse ? "animate-pulse" : ""}`} />
  );
}

export function SkeletonBlock({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer rounded-xl bg-neutral-200/70 dark:bg-zinc-800/80 ${className}`}
    />
  );
}

export function ToolbarSkeleton({ actions = 3, hasSearch = true }) {
  return (
    <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <SkeletonBlock className="h-5 w-24 rounded-lg" />
      <div className="h-5 w-px bg-neutral-200 dark:bg-zinc-700" />
      {Array.from({ length: actions }).map((_, index) => (
        <SkeletonBlock key={index} className="h-9 w-28" />
      ))}
      {hasSearch && <SkeletonBlock className="ml-2 h-9 flex-1" />}
    </div>
  );
}

export function CardListSkeleton({ count = 4 }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-neutral-200/60 bg-white/80 p-5 shadow-sm shadow-neutral-200/40 dark:border-zinc-800/60 dark:bg-zinc-900/80 dark:shadow-black/10"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-4 w-2/5" />
              <SkeletonBlock className="mt-3 h-3 w-1/4 rounded-lg" />
              <SkeletonBlock className="mt-4 h-3 w-full rounded-lg" />
              <SkeletonBlock className="mt-2 h-3 w-4/5 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <SkeletonBlock className="h-8 w-9" />
              <SkeletonBlock className="h-8 w-9" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, columns = 5 }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-100 dark:border-zinc-800">
      <div className="grid gap-3 border-b border-neutral-100 p-3 dark:border-zinc-800" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonBlock key={index} className="h-3 rounded-lg" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-3 border-b border-neutral-50 p-3 last:border-0 dark:border-zinc-800/60" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, column) => (
            <SkeletonBlock key={column} className={`h-4 rounded-lg ${column === 0 ? "w-3/4" : "w-full"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ title = "Loading", layout = "dashboard" }) {
  if (layout === "split") {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950" aria-busy="true" aria-label={title}>
        <ToolbarSkeleton />
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[292px] shrink-0 border-r border-neutral-200 bg-neutral-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <CardListSkeleton count={5} />
          </div>
          <div className="min-w-0 flex-1 overflow-auto p-5">
            <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => <SkeletonBlock key={index} className="h-24" />)}
            </div>
            <SkeletonBlock className="mb-4 h-32" />
            <TableSkeleton rows={7} columns={4} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-neutral-100 dark:bg-zinc-950" aria-busy="true" aria-label={title}>
      <ToolbarSkeleton />
      <div className="flex-1 overflow-auto p-5">
        <div className="mb-4 grid gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="h-28" />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <SkeletonBlock className="h-72" />
          <SkeletonBlock className="h-72" />
        </div>
        <div className="mt-4">
          <TableSkeleton rows={5} columns={5} />
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  const confirmClass = tone === "danger"
    ? "border border-rose-500/30 bg-rose-500 text-white shadow-sm shadow-rose-500/20 hover:bg-rose-400"
    : "border border-emerald-500/30 bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-400";

  return (
    <div className="fixed inset-0 z-300 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40">
        <div className="mb-5">
          <p className="text-[15px] font-semibold text-neutral-900 dark:text-zinc-50">{title}</p>
          {description && (
            <p className="mt-1.5 text-[13px] leading-5 text-neutral-500 dark:text-zinc-400">{description}</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-9 rounded-xl px-3 text-[13px] font-semibold transition ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title }) {
  return (
    <div className="mb-7">
      {eyebrow && <p className="mb-0.5 text-[13px] text-neutral-500 dark:text-zinc-500">{eyebrow}</p>}
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-zinc-50">{title}</h1>
    </div>
  );
}
