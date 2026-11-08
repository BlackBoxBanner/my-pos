import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Field } from "./Field";
import { inputClassNames, type ControlSize } from "./inputClasses";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  hint?: ReactNode;
  error?: string | boolean | null;
  size?: ControlSize;
  unlabeled?: boolean;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  {
    label,
    hint,
    error,
    size = "md",
    className = "",
    id,
    unlabeled,
    ...rest
  },
  ref,
) {
  const inputId = id ?? (label ? `input-${label.replace(/\s+/g, "-")}` : undefined);
  const hasError = Boolean(error);

  const inputEl = (
    <input
      ref={ref}
      id={inputId}
      aria-invalid={hasError || undefined}
      className={inputClassNames(size, { error: hasError, className })}
      {...rest}
    />
  );

  if (unlabeled || !label) {
    if (hint || error) {
      return (
        <Field hint={hint} error={error} htmlFor={inputId}>
          {inputEl}
        </Field>
      );
    }
    return inputEl;
  }

  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId}>
      {inputEl}
    </Field>
  );
});
