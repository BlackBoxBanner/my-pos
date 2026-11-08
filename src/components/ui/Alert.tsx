import type { ReactNode } from "react";

type Tone = "error" | "success" | "warning" | "info";

const toneClass: Record<Tone, string> = {
  error: "bg-[var(--color-danger-soft)] text-red-700",
  success: "bg-[var(--color-success-soft)] text-emerald-800",
  warning: "bg-[var(--color-warning-soft)] text-amber-900",
  info: "bg-slate-100 text-slate-700",
};

export function Alert({
  tone = "info",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-xl px-3 py-2 text-sm ${toneClass[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
