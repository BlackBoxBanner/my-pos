import { useEffect, useState } from "react";
import type { Product } from "../lib/api";
import { formatBaht, parseBahtInput, satangToBahtInput } from "../lib/money";
import { Button } from "./ui/Button";
import { Checkbox } from "./ui/Checkbox";
import { TableInput } from "./ui/TableInput";

type Props = {
  rows: Product[];
  savingIds: Set<number>;
  rowErrors: Record<number, string>;
  onPatch: (id: number, patch: Partial<Product>) => void;
  onFlushSave: (id: number) => void;
  onTogglePin: (p: Product) => void;
  onDelete: (p: Product) => void;
};

export function EditableProductsTable({
  rows,
  savingIds,
  rowErrors,
  onPatch,
  onFlushSave,
  onTogglePin,
  onDelete,
}: Props) {
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    setPriceDrafts((prev) => {
      const next = { ...prev };
      for (const p of rows) {
        const formatted = satangToBahtInput(p.priceSatang);
        const draft = prev[p.id];
        if (draft === undefined) {
          next[p.id] = formatted;
        } else {
          const parsed = parseBahtInput(draft);
          if (parsed === p.priceSatang) {
            next[p.id] = formatted;
          }
        }
      }
      return next;
    });
  }, [rows]);

  const setPriceDraft = (id: number, value: string) => {
    setPriceDrafts((prev) => ({ ...prev, [id]: value }));
  };

  const commitPrice = (p: Product) => {
    const raw = priceDrafts[p.id] ?? satangToBahtInput(p.priceSatang);
    const priceSatang = parseBahtInput(raw);
    if (priceSatang === null) {
      setPriceDraft(p.id, satangToBahtInput(p.priceSatang));
      return;
    }
    setPriceDraft(p.id, satangToBahtInput(priceSatang));
    if (priceSatang !== p.priceSatang) {
      onPatch(p.id, { priceSatang });
    } else {
      onFlushSave(p.id);
    }
  };

  const onPriceChange = (p: Product, value: string) => {
    setPriceDraft(p.id, value);
    const priceSatang = parseBahtInput(value);
    if (priceSatang !== null && priceSatang !== p.priceSatang) {
      onPatch(p.id, { priceSatang });
    }
  };

  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[880px] text-left text-sm">
      <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
        <tr>
          <th className="px-3 py-3 font-medium">ชื่อ</th>
          <th className="px-3 py-3 font-medium">บาร์โค้ด</th>
          <th className="px-3 py-3 font-medium">ราคา</th>
          <th className="px-3 py-3 font-medium">สต็อก</th>
          <th className="px-3 py-3 font-medium">เกณฑ์ต่ำ</th>
          <th className="px-3 py-3 font-medium">สถานะ</th>
          <th className="px-3 py-3 font-medium">ปักหมุด</th>
          <th className="px-3 py-3 font-medium w-28"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => {
          const low = p.stockQty <= p.lowStockQty;
          const saving = savingIds.has(p.id);
          const rowError = rowErrors[p.id];
          return (
            <tr
              key={p.id}
              className={`border-t border-slate-100 ${
                rowError ? "bg-red-50/80" : "hover:bg-slate-50/80"
              }`}
              title={rowError}
            >
              <td className="min-w-0 px-3 py-2 align-top">
                <TableInput
                  value={p.name}
                  onChange={(e) => onPatch(p.id, { name: e.target.value })}
                  onBlur={() => onFlushSave(p.id)}
                  className="min-w-[120px]"
                  aria-label={`ชื่อ ${p.name}`}
                />
                {low && (
                  <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    สต็อกต่ำ
                  </span>
                )}
              </td>
              <td className="min-w-0 px-3 py-2 align-top">
                <TableInput
                  value={p.barcode ?? ""}
                  onChange={(e) =>
                    onPatch(p.id, {
                      barcode: e.target.value.trim() ? e.target.value : null,
                    })
                  }
                  onBlur={() => onFlushSave(p.id)}
                  placeholder="—"
                  className="min-w-[100px]"
                  aria-label={`บาร์โค้ด ${p.name}`}
                />
              </td>
              <td className="px-3 py-2 align-top">
                <TableInput
                  value={priceDrafts[p.id] ?? satangToBahtInput(p.priceSatang)}
                  onChange={(e) => onPriceChange(p, e.target.value)}
                  onBlur={() => commitPrice(p)}
                  inputMode="decimal"
                  className="w-24 tabular-nums"
                  aria-label={`ราคา ${p.name}`}
                />
                <span className="mt-0.5 block text-xs text-slate-400">
                  {formatBaht(p.priceSatang)}
                </span>
              </td>
              <td
                className={`px-3 py-2 align-middle tabular-nums ${
                  low ? "font-semibold text-amber-700" : "text-slate-700"
                }`}
                title="ปรับสต็อกที่แท็บสต็อก"
              >
                {p.stockQty}
              </td>
              <td className="px-3 py-2 align-top">
                <TableInput
                  value={p.lowStockQty}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 0) {
                      onPatch(p.id, { lowStockQty: n });
                    }
                  }}
                  onBlur={() => onFlushSave(p.id)}
                  inputMode="numeric"
                  className="w-16 tabular-nums"
                  aria-label={`เกณฑ์สต็อกต่ำ ${p.name}`}
                />
              </td>
              <td className="px-3 py-2 align-middle">
                <Checkbox
                  className="whitespace-nowrap !items-center"
                  label={
                    p.active ? (
                      <span className="text-emerald-700">เปิดขาย</span>
                    ) : (
                      <span className="text-slate-400">ปิดขาย</span>
                    )
                  }
                  checked={p.active}
                  onChange={(e) => {
                    onPatch(p.id, { active: e.target.checked });
                    onFlushSave(p.id);
                  }}
                  aria-label={`สถานะขาย ${p.name}`}
                />
              </td>
              <td className="px-3 py-2 align-middle">
                <button
                  type="button"
                  onClick={() => onTogglePin(p)}
                  className={
                    p.pinned
                      ? "text-amber-700 hover:underline"
                      : "text-slate-500 hover:text-emerald-700 hover:underline"
                  }
                  title={
                    p.pinned
                      ? "เลิกปักหมุดบนหน้าขาย"
                      : "ปักหมุดไว้บนหน้าขาย"
                  }
                >
                  {p.pinned ? "ปักหมุดแล้ว" : "ปักหมุด"}
                </button>
              </td>
              <td className="px-3 py-2 align-middle text-right">
                <div className="flex flex-col items-end gap-1">
                  {saving && (
                    <span className="text-xs text-slate-400">กำลังบันทึก…</span>
                  )}
                  {rowError && (
                    <span className="max-w-[10rem] text-left text-xs text-red-600">
                      {rowError}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => onDelete(p)}
                  >
                    ลบ
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
