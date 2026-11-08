import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "../lib/api";
import { Field } from "./ui/Field";
import { Input } from "./ui/Input";

type Props = {
  products: Product[];
  value: number | "";
  onChange: (id: number | "") => void;
  lowStockOnly?: boolean;
};

export function ProductCombobox({
  products,
  value,
  onChange,
  lowStockOnly,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = products.find((p) => p.id === value);

  const filtered = useMemo(() => {
    let list = products;
    if (lowStockOnly) {
      list = list.filter((p) => p.stockQty <= p.lowStockQty);
    }
    const query = q.trim().toLowerCase();
    if (!query) return list.slice(0, 40);
    return list
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.barcode ?? "").toLowerCase().includes(query),
      )
      .slice(0, 40);
  }, [products, q, lowStockOnly]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <Field label="สินค้า">
        <Input
          unlabeled
          value={
            open
              ? q
              : selected
                ? `${selected.name} (คงเหลือ ${selected.stockQty})`
                : q
          }
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (value !== "") onChange("");
          }}
          onFocus={() => {
            setOpen(true);
            setQ("");
          }}
          placeholder="ค้นหาชื่อหรือบาร์โค้ด"
        />
      </Field>
      {open && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">ไม่พบสินค้า</li>
          )}
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-emerald-50"
                onClick={() => {
                  onChange(p.id);
                  setQ("");
                  setOpen(false);
                }}
              >
                <span>
                  {p.name}
                  {p.barcode ? (
                    <span className="ml-2 text-xs text-slate-400">
                      {p.barcode}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-slate-500">
                  คงเหลือ {p.stockQty}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
