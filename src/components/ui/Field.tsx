import type { ReactNode } from "react";

type Props = {
  label?: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | boolean | null;
  className?: string;
  children: ReactNode;
};

export function Field({
  label,
  htmlFor,
  hint,
  error,
  className = "",
  children,
}: Props) {
  return (
    <div className={`min-w-0 ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}
      {children}
      {typeof error === "string" && error.trim() !== "" && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
    </div>
  );
}
