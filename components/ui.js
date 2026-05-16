"use client";

export function Button({ className = "", variant = "primary", ...props }) {
  const variants = {
    primary: "border-emerald-500/60 bg-emerald-500 text-black hover:bg-emerald-400",
    neutral: "border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800",
    danger: "border-rose-500/60 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
    ghost: "border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-900",
  };

  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 border px-4 text-sm font-bold transition ${variants[variant]} ${className}`}
    />
  );
}

export function Section({ title, eyebrow, icon: Icon, children, aside }) {
  return (
    <section className="control-card overflow-hidden rounded-lg">
      <div className="flex flex-col gap-3 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {Icon ? (
            <div className="flex h-9 w-9 items-center justify-center border border-zinc-700 bg-zinc-950 text-emerald-300">
              <Icon size={18} />
            </div>
          ) : null}
          <div>
            {eyebrow ? <p className="mono text-[11px] uppercase tracking-wider text-zinc-500">{eyebrow}</p> : null}
            <h2 className="text-lg font-extrabold text-zinc-50">{title}</h2>
          </div>
        </div>
        {aside}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatusDot({ tone = "zinc", pulse = false }) {
  const color = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    zinc: "bg-zinc-500",
  }[tone];
  return <span className={`h-2.5 w-2.5 ${color} ${pulse ? "animate-pulse" : ""}`} />;
}
