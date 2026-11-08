import { formatBaht } from "../lib/money";
import { formatDateTime } from "../lib/datetime";
import type { Sale } from "../lib/api";
import { Button } from "./ui/Button";

type Props = {
  sale: Sale;
  shopName?: string;
  shopAddress?: string;
  onClose: () => void;
  onNewSale: () => void;
  onVoid?: () => void;
};

export function ReceiptModal({
  sale,
  shopName = "My POS",
  shopAddress,
  onClose,
  onNewSale,
  onVoid,
}: Props) {
  const voided = sale.status === "voided";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 print:static print:bg-white print:p-0">
      <div
        id="receipt-print"
        className="w-full max-w-md rounded-2xl bg-white shadow-xl print:max-w-[80mm] print:rounded-none print:shadow-none"
      >
        <div className="border-b border-slate-200 px-5 py-4 text-center">
          <h2 className="text-lg font-semibold text-slate-900">{shopName}</h2>
          {shopAddress && (
            <p className="mt-1 text-xs text-slate-500">{shopAddress}</p>
          )}
          <p className="mt-2 text-sm font-medium text-slate-700">ใบเสร็จ</p>
          <p className="text-sm text-slate-500">{sale.receiptNo}</p>
          <p className="text-xs text-slate-400">
            {formatDateTime(sale.createdAt)}
          </p>
          {voided && (
            <p className="mt-2 text-sm font-semibold text-red-600">
              ยกเลิกแล้ว
              {sale.voidedAt ? ` · ${formatDateTime(sale.voidedAt)}` : ""}
            </p>
          )}
        </div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto px-5 py-4 print:max-h-none print:overflow-visible">
          {sale.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 text-sm">
              <div>
                <div className="font-medium text-slate-800">{item.name}</div>
                <div className="text-slate-500">
                  {item.qty} × {formatBaht(item.unitPriceSatang)}
                </div>
              </div>
              <div className="shrink-0 font-medium">
                {formatBaht(item.lineTotalSatang)}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-1 border-t border-slate-200 px-5 py-4 text-sm">
          <div className="flex justify-between text-base font-semibold">
            <span>ยอดรวม</span>
            <span>{formatBaht(sale.totalSatang)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>รับเงิน</span>
            <span>{formatBaht(sale.paidSatang)}</span>
          </div>
          <div className="flex justify-between font-medium text-emerald-700">
            <span>เงินทอน</span>
            <span>{formatBaht(sale.changeSatang)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4 no-print">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            ปิด
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => window.print()}
          >
            พิมพ์
          </Button>
          {onVoid && !voided && (
            <Button variant="danger" className="flex-1" onClick={onVoid}>
              ยกเลิกบิล
            </Button>
          )}
          <Button variant="primary" className="flex-1" onClick={onNewSale}>
            ขายต่อ
          </Button>
        </div>
      </div>
    </div>
  );
}
