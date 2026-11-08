import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "warning";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary:
    "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:bg-slate-300",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50",
  ghost: "text-slate-600 hover:bg-slate-100 disabled:opacity-50",
  danger:
    "border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50",
  warning:
    "bg-amber-600 text-white hover:bg-amber-700 disabled:bg-slate-300",
};

const sizeClass = {
  sm: "min-h-9 px-3 py-1.5 text-sm",
  md: "min-h-[var(--touch-min)] px-4 py-2.5 text-sm",
  lg: "min-h-12 px-4 py-3 text-base font-semibold",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition disabled:cursor-not-allowed ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
