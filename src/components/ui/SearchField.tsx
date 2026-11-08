import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "./Input";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
};

export const SearchField = forwardRef<HTMLInputElement, Props>(
  function SearchField({ label, className = "", ...rest }, ref) {
    return (
      <Input
        ref={ref}
        unlabeled={!label}
        label={label}
        type="search"
        className={`min-w-0 flex-1 sm:min-w-[12rem] ${className}`}
        {...rest}
      />
    );
  },
);
