import { formatBaht } from "../lib/money";
import type { TodayReport } from "../lib/api";
import { Button } from "./ui/Button";

export type AppTab =
  | "sell"
  | "products"
  | "stock"
  | "reports"
  | "settings";

const NAV: { id: AppTab; label: string; primary?: boolean; shortcut: string }[] =
  [
    { id: "sell", label: "ขาย", primary: true, shortcut: "1" },
    { id: "products", label: "สินค้า", shortcut: "2" },
    { id: "stock", label: "สต็อก", shortcut: "3" },
    { id: "reports", label: "รายงาน", shortcut: "4" },
    { id: "settings", label: "ตั้งค่า", shortcut: "5" },
  ];

type Props = {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  report: TodayReport | null;
  lowStockCount: number;
  isTauri: boolean;
  onOpenCheatsheet?: () => void;
};

export function AppHeader({
  tab,
  onTabChange,
  report,
  lowStockCount,
  isTauri,
  onOpenCheatsheet,
}: Props) {
  return (
    <header className="no-print shrink-0 border-b border-slate-200 bg-white">
      {!isTauri && (
        <div className="bg-amber-100 px-4 py-2 text-sm text-amber-950">
          เปิดแอปด้วย <code className="font-semibold">npm run tauri dev</code>{" "}
          — เบราว์เซอร์อย่างเดียวเรียกฐานข้อมูลไม่ได้
        </div>
      )}
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="mr-2 shrink-0 text-base font-bold tracking-wide text-slate-900">
          My POS
        </div>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={`Ctrl+${item.shortcut}`}
                onClick={() => onTabChange(item.id)}
                className={`focus-ring shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? item.primary
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {lowStockCount > 0 && (
            <button
              type="button"
              onClick={() => onTabChange("stock")}
              className="focus-ring rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900"
              title="ไปหน้าสต็อก"
            >
              สต็อกต่ำ {lowStockCount}
            </button>
          )}
          {report && (
            <div
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                report.dayClosed
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-50 text-emerald-800"
              }`}
              title={`ยอดวันนี้ ${formatBaht(report.totalSatang)}`}
            >
              {report.businessDate} ·{" "}
              {report.dayClosed ? "ปิดยอดแล้ว" : "เปิดขาย"} ·{" "}
              {formatBaht(report.totalSatang)}
            </div>
          )}
          {onOpenCheatsheet && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenCheatsheet}
              title="คีย์ลัด (?)"
            >
              ?
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export { NAV as APP_NAV };
