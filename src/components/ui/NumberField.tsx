import { forwardRef, type InputHTMLAttributes } from "react";
import { inputClassNames, type ControlSize } from "./inputClasses";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  inputSize?: ControlSize;
  error?: boolean;
};

/** Narrow numeric control (e.g. cart qty) — not wrapped in Field. */
export const NumberField = forwardRef<HTMLInputElement, Props>(
  function NumberField(
    { inputSize = "sm", error, className = "", ...rest },
    ref,
  ) {
    return (
      <input
        ref={ref}
        className={inputClassNames(inputSize, {
          error,
          className: `w-14 text-center tabular-nums ${className}`,
        })}
        {...rest}
      />
    );
  },
);
