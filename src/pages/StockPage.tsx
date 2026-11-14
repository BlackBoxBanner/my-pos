import { useEffect, useRef, useState } from "react";
import {
  adjustStock,
  errorMessage,
  listProducts,
  listStockMovements,
  receiveStock,
  type Product,
  type StockMovement,
} from "../lib/api";
import { formatDateTime } from "../lib/datetime";
import { useShop } from "../lib/shopContext";
import { ProductCombobox } from "../components/ProductCombobox";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Checkbox } from "../components/ui/Checkbox";
import { Input } from "../components/ui/Input";

export function StockPage({ active }: { active?: boolean }) {
  const { refreshStatus } = useShop();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [productId, setProductId] = useState<number | "">("");
  const [mode, setMode] = useState<"receive" | "adjust">("receive");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [lowOnly, setLowOnly] = useState(false);

  const load = async () => {
    try {
      const [p, m] = await Promise.all([
        listProducts(undefined, true),
        listStockMovements(40),
      ]);
      setProducts(p);
      setMovements(m);
      void refreshStatus();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  useEffect(() => {
    if (active !== false) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const selected = products.find((p) => p.id === productId);

  const submit = async () => {
    if (busyRef.current) return;
    if (productId === "") {
      setError("กรุณาเลือกสินค้า");
      return;
    }
    const n = Number(qty);
    if (!Number.isInteger(n) || (mode === "receive" ? n <= 0 : n < 0)) {
      setError(
        mode === "receive"
          ? "จำนวนรับเข้าต้องเป็นจำนวนเต็มมากกว่า 0"
          : "จำนวนสต็อกใหม่ต้องเป็นจำนวนเต็มไม่ติดลบ",
      );
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (mode === "receive") {
        await receiveStock(productId, n, note || undefined);
      } else {
        await adjustStock(productId, n, note || undefined);
      }
      setQty("");
      setNote("");
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const reasonLabel = (reason: string) => {
    if (reason === "receive") return "รับเข้า";
    if (reason === "adjust") return "ปรับยอด";
    if (reason === "sale") return "ขาย";
    if (reason === "void") return "ยกเลิกบิล";
    return reason;
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
      <section className="w-full shrink-0 space-y-4 card-surface p-4 lg:w-[400px]">
        <h2 className="text-lg font-semibold">ปรับสต็อก</h2>
        {error && <Alert tone="error">{error}</Alert>}
        <Checkbox
          className="text-slate-600"
          label="แสดงเฉพาะสต็อกต่ำในรายการค้นหา"
          checked={lowOnly}
          onChange={(e) => setLowOnly(e.target.checked)}
        />
        <ProductCombobox
          products={products}
          value={productId}
          onChange={setProductId}
          lowStockOnly={lowOnly}
        />
        {selected && (
          <p className="text-sm text-slate-600">
            คงเหลือปัจจุบัน:{" "}
            <span className="font-semibold text-slate-900">
              {selected.stockQty}
            </span>
            {selected.stockQty <= selected.lowStockQty && (
              <span className="ml-2 text-amber-700">สต็อกต่ำ</span>
            )}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            variant={mode === "receive" ? "primary" : "secondary"}
            className="flex-1"
            onClick={() => setMode("receive")}
          >
            รับเข้า
          </Button>
          <Button
            variant={mode === "adjust" ? "primary" : "secondary"}
            className="flex-1"
            onClick={() => setMode("adjust")}
          >
            ปรับยอด
          </Button>
        </div>
        <Input
          label={mode === "receive" ? "จำนวนที่รับเข้า" : "จำนวนสต็อกใหม่"}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="numeric"
        />
        <Input
          label="หมายเหตุ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button
          variant="primary"
          className="w-full"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </section>

      <section className="min-h-0 flex-1 overflow-auto card-surface">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold">ประวัติการเคลื่อนไหว</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">เวลา</th>
                <th className="px-4 py-3 font-medium">สินค้า</th>
                <th className="px-4 py-3 font-medium">ประเภท</th>
                <th className="px-4 py-3 font-medium">จำนวน</th>
                <th className="px-4 py-3 font-medium">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    ยังไม่มีการเคลื่อนไหวสต็อก
                  </td>
                </tr>
              )}
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-500">
                    {formatDateTime(m.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium">{m.productName}</td>
                  <td className="px-4 py-3">{reasonLabel(m.reason)}</td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      m.qtyDelta < 0 ? "text-red-600" : "text-emerald-700"
                    }`}
                  >
                    {m.qtyDelta > 0 ? `+${m.qtyDelta}` : m.qtyDelta}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{m.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
