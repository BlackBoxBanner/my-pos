/** Shared datetime formatting for Asia/Bangkok display. */

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatTime(iso: string): string {
  return formatDateTime(iso);
}
