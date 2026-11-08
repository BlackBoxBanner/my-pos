import { memo } from "react";
import type { Product } from "../lib/api";
import { formatBaht } from "../lib/money";

type Props = {
  product: Product;
  pinnedHighlight?: boolean;
  onAdd: (product: Product) => void;
};

export const ProductSellTile = memo(function ProductSellTile({
  product: p,
  pinnedHighlight,
  onAdd,
}: Props) {
  const out = p.stockQty < 1;
  const low = p.stockQty <= p.lowStockQty;

  return (
    <button
      type="button"
      disabled={out}
      onClick={() => onAdd(p)}
      className={`focus-ring flex min-h-[88px] flex-col items-start justify-between rounded-xl border px-3 py-3 text-left transition ${
        out
          ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-50"
          : pinnedHighlight
            ? "border-amber-200 bg-amber-50/80 hover:border-amber-400 hover:bg-amber-50 active:scale-[0.98]"
            : "border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50 active:scale-[0.98]"
      }`}
    >
      <div className="w-full">
        <div className="line-clamp-2 text-sm font-semibold text-slate-800">
          {p.name}
          {p.pinned && pinnedHighlight && (
            <span className="ml-1 text-xs font-medium text-amber-700">★</span>
          )}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {p.barcode ? p.barcode : "ไม่มีบาร์โค้ด"}
          {" · "}สต็อก {p.stockQty}
          {low && !out && (
            <span className="ml-1 text-amber-700">ต่ำ</span>
          )}
          {out && <span className="ml-1 text-red-600">หมด</span>}
        </div>
      </div>
      <div className="mt-2 text-base font-bold text-emerald-700">
        {formatBaht(p.priceSatang)}
      </div>
    </button>
  );
});
