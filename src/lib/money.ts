/** Money helpers — store/transmit integer satang (1 บาท = 100 สตางค์) */

export function formatBaht(satang: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(satang / 100);
}

export function bahtToSatang(baht: number): number {
  return Math.round(baht * 100);
}

/** Parse Thai baht input like "12.50" or "12,50" into satang. */
export function parseBahtInput(value: string): number | null {
  const cleaned = value.trim().replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return bahtToSatang(n);
}

export function satangToBahtInput(satang: number): string {
  return (satang / 100).toFixed(2);
}
