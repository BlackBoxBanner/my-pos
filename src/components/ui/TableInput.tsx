import { forwardRef, type InputHTMLAttributes } from "react";
import { inputClassNames } from "./inputClasses";

type Props = InputHTMLAttributes<HTMLInputElement>;

/** Compact table cell input — same tokens as modals, smaller touch target. */
export const TableInput = forwardRef<HTMLInputElement, Props>(
  function TableInput({ className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={inputClassNames("sm", { className: `w-full ${className}` })}
        {...rest}
      />
    );
  },
);
