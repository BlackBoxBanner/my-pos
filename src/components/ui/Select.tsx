import type { ReactNode, SelectHTMLAttributes } from "react";
import { Field } from "./Field";
import { selectSizeClass, type ControlSize } from "./inputClasses";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  label?: string;
  hint?: ReactNode;
  error?: string | null;
  controlSize?: ControlSize;
};

export function Select({
  label,
  hint,
  error,
  controlSize = "sm",
  className = "",
  id,
  children,
  ...rest
}: Props) {
  const selectId =
    id ?? (label ? `select-${label.replace(/\s+/g, "-")}` : undefined);
  const hasError = Boolean(error);

  const selectEl = (
    <select
      id={selectId}
      aria-invalid={hasError || undefined}
      className={`focus-ring min-w-0 ${selectSizeClass[controlSize]} ${
        hasError ? "field-select--error" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </select>
  );

  if (!label) {
    return selectEl;
  }

  return (
    <Field label={label} hint={hint} error={error} htmlFor={selectId}>
      {selectEl}
    </Field>
  );
}
