import type { InputHTMLAttributes, ReactNode } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  label: ReactNode;
  description?: ReactNode;
};

export function Checkbox({
  label,
  description,
  className = "",
  id,
  ...rest
}: Props) {
  const inputId =
    id ?? (typeof label === "string" ? `chk-${label.replace(/\s+/g, "-")}` : undefined);

  return (
    <label
      htmlFor={inputId}
      className={`flex min-w-0 cursor-pointer items-start gap-2 text-sm text-slate-700 ${className}`}
    >
      <input
        id={inputId}
        type="checkbox"
        className="field-checkbox mt-0.5 shrink-0"
        {...rest}
      />
      <span className="min-w-0">
        <span className="block leading-snug">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
        )}
      </span>
    </label>
  );
}
