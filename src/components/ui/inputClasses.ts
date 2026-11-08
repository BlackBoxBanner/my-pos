export type ControlSize = "sm" | "md" | "lg";

export const inputSizeClass: Record<ControlSize, string> = {
  sm: "field-input field-input--sm",
  md: "field-input",
  lg: "field-input field-input--lg",
};

export const selectSizeClass: Record<ControlSize, string> = {
  sm: "field-select field-select--sm",
  md: "field-select",
  lg: "field-select field-select--lg",
};

export function inputClassNames(
  size: ControlSize = "md",
  opts?: { error?: boolean; className?: string },
): string {
  const parts = [inputSizeClass[size], "focus-ring min-w-0"];
  if (opts?.error) parts.push("field-input--error");
  if (opts?.className) parts.push(opts.className);
  return parts.filter(Boolean).join(" ");
}
