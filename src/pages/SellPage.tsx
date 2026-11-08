import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  checkout,
  errorMessage,
  getProductByBarcode,
  getProductsByIds,
  listProducts,
  type Product,
  type Sale,
} from "../lib/api";
import { formatBaht, parseBahtInput } from "../lib/money";
import { playErrorSound, playSuccessSound } from "../lib/sounds";
import { useShop } from "../lib/shopContext";
import { ReceiptModal } from "../components/ReceiptModal";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { NumberField } from "../components/ui/NumberField";
import { SearchField } from "../components/ui/SearchField";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ProductSellTile } from "../components/ProductSellTile";

type CartLine = {
  product: Product;
  qty: number;
};

type Props = {
  onAddProduct?: (barcode: string) => void;
  onGoImport?: () => void;
  active?: boolean;
};

const DENOMS = [20, 50, 100, 500, 1000];
const PAGE_HINT =
  "Enter สแกน · 3*บาร์โค้ด · F9 ชำระ · Esc ล้าง · Ctrl+1 แท็บขาย";

export function SellPage({ onAddProduct, onGoImport, active = true }: Props) {
  const scanRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const { report, settings, refreshStatus } = useShop();
  const dayClosed = report?.dayClosed ?? false;

  const [scan, setScan] = useState("");
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paidInput, setPaidInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const p = await listProducts(undefined, false);
      setCatalog(p);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    if (active) {
      scanRef.current?.focus();
      void refreshStatus();
      void refreshCartProducts();
      void loadCatalog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const browseProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q),
    );
  }, [catalog, search]);

  const searchActive = search.trim().length > 0;

  const pinnedProducts = useMemo(
    () => (searchActive ? [] : catalog.filter((p) => p.pinned)),
    [catalog, searchActive],
  );

  const gridProducts = useMemo(() => {
    if (searchActive) return browseProducts;
    return browseProducts.filter((p) => !p.pinned);
  }, [browseProducts, searchActive]);

  const catalogEmpty = catalog.length === 0;

  const totalSatang = useMemo(
    () =>
      cart.reduce((sum, line) => sum + line.product.priceSatang * line.qty, 0),
    [cart],
  );

  const paidSatang = parseBahtInput(paidInput);
  const changeSatang =
    paidSatang !== null && paidSatang >= totalSatang
      ? paidSatang - totalSatang
      : null;

  const payDisabledReason = (() => {
    if (busy) return "กำลังบันทึก…";
    if (dayClosed) return "ปิดยอดแล้ว";
    if (cart.length === 0) return "ตะกร้าว่าง";
    if (paidSatang === null) return "กรุณาระบุเงินที่รับ";
    if (paidSatang < totalSatang) return "รับเงินไม่พอ";
    return null;
  })();

  const refreshCartProducts = async () => {
    setCart((prev) => {
      if (prev.length === 0) return prev;
      const ids = prev.map((l) => l.product.id);
      void (async () => {
        try {
          const freshList = await getProductsByIds(ids);
          const byId = new Map(freshList.map((p) => [p.id, p]));
          const warnings: string[] = [];
          setCart((cur) =>
            cur.map((line) => {
              const fresh = byId.get(line.product.id);
              if (!fresh) {
                warnings.push(`ไม่พบสินค้า "${line.product.name}"`);
                return line;
              }
              if (fresh.priceSatang !== line.product.priceSatang) {
                warnings.push(`ราคา "${fresh.name}" เปลี่ยนแล้ว`);
              }
              if (line.qty > fresh.stockQty) {
                warnings.push(
                  `"${fresh.name}" สต็อกเหลือ ${fresh.stockQty} (ในตะกร้า ${line.qty})`,
                );
              }
              return { ...line, product: fresh };
            }),
          );
          setWarn(warnings.length ? warnings.join(" · ") : null);
        } catch (e) {
          setError(errorMessage(e));
        }
      })();
      return prev;
    });
  };

  const addToCart = useCallback((product: Product, addQty = 1) => {
    setError(null);
    setUnknownBarcode(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        const nextQty = existing.qty + addQty;
        if (nextQty > product.stockQty) {
          setError(
            `สินค้า "${product.name}" สต็อกไม่พอ (เหลือ ${product.stockQty})`,
          );
          return prev;
        }
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: nextQty, product } : l,
        );
      }
      if (product.stockQty < addQty) {
        setError(
          product.stockQty < 1
            ? `สินค้า "${product.name}" หมดสต็อก`
            : `สินค้า "${product.name}" สต็อกไม่พอ (เหลือ ${product.stockQty})`,
        );
        return prev;
      }
      return [...prev, { product, qty: addQty }];
    });
  }, []);

  const setQty = (productId: number, qty: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product.id !== productId) return l;
          if (qty > l.product.stockQty) {
            setError(
              `สินค้า "${l.product.name}" สต็อกไม่พอ (เหลือ ${l.product.stockQty})`,
            );
            return l;
          }
          return { ...l, qty };
        })
        .filter((l) => l.qty > 0),
    );
  };

  const parseScanQty = (raw: string): { qty: number; code: string } => {
    const trimmed = raw.trim();
    const star = trimmed.indexOf("*");
    if (star > 0) {
      const q = Number(trimmed.slice(0, star));
      const code = trimmed.slice(star + 1).trim();
      if (Number.isInteger(q) && q > 0 && code) return { qty: q, code };
    }
    return { qty: 1, code: trimmed };
  };

  const handleScan = async () => {
    const { qty, code } = parseScanQty(scan);
    if (!code) return;
    setScan("");
    setError(null);
    setUnknownBarcode(null);
    try {
      const product = await getProductByBarcode(code);
      if (!product) {
        setUnknownBarcode(code);
        playErrorSound(settings.soundEnabled);
        return;
      }
      addToCart(product, qty);
    } catch (e) {
      setError(errorMessage(e));
      playErrorSound(settings.soundEnabled);
    } finally {
      scanRef.current?.focus();
    }
  };

  const handleCheckout = async () => {
    if (busyRef.current || payDisabledReason) {
      if (payDisabledReason && payDisabledReason !== "กำลังบันทึก…") {
        setError(payDisabledReason);
        playErrorSound(settings.soundEnabled);
      }
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const sale = await checkout(
        cart.map((l) => ({ productId: l.product.id, qty: l.qty })),
        paidSatang!,
      );
      playSuccessSound(settings.soundEnabled);
      setReceipt(sale);
      setCart([]);
      setPaidInput("");
      setSearch("");
      setWarn(null);
      void refreshStatus();
      void loadCatalog();
      if (settings.autoPrint) {
        setTimeout(() => window.print(), 300);
      }
    } catch (e) {
      setError(errorMessage(e));
      playErrorSound(settings.soundEnabled);
    } finally {
      busyRef.current = false;
      setBusy(false);
      scanRef.current?.focus();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!active || receipt) return;
      if (e.key === "F9") {
        e.preventDefault();
        void handleCheckout();
      }
      if (e.key === "Escape" && cart.length > 0) {
        e.preventDefault();
        setConfirmClear(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, receipt, cart.length, paidSatang, dayClosed, busy, settings]);

  const addDenom = (baht: number) => {
    const current = paidSatang ?? 0;
    setPaidInput(((current + baht * 100) / 100).toFixed(2));
  };

  const isLow = (p: Product) => p.stockQty <= p.lowStockQty;

  const handleTileAdd = useCallback(
    (p: Product) => {
      addToCart(p);
      scanRef.current?.focus();
    },
    [addToCart],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <p className="no-print shrink-0 text-xs text-slate-500">{PAGE_HINT}</p>

      {dayClosed && (
        <Alert tone="warning">ปิดยอดวันนี้แล้ว — ไม่สามารถขายเพิ่มได้</Alert>
      )}

      {catalogEmpty && (
        <Alert tone="info">
          ยังไม่มีสินค้า —{" "}
          {onGoImport && (
            <button
              type="button"
              className="font-medium text-emerald-700 underline"
              onClick={onGoImport}
            >
              นำเข้า CSV
            </button>
          )}{" "}
          หรือเพิ่มจากแท็บสินค้า
        </Alert>
      )}

      <section className="card-surface shrink-0 p-4">
        <Input
          ref={scanRef}
          label="สแกนบาร์โค้ด"
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleScan();
            }
          }}
          placeholder="สแกนหรือพิมพ์ เช่น 3*8850001"
          size="lg"
          className="field-input--accent"
        />
        {unknownBarcode && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span>ไม่พบบาร์โค้ด {unknownBarcode}</span>
            {onAddProduct && (
              <Button
                variant="warning"
                size="sm"
                onClick={() => onAddProduct(unknownBarcode)}
              >
                เพิ่มสินค้า
              </Button>
            )}
            {onGoImport && (
              <Button variant="secondary" size="sm" onClick={onGoImport}>
                นำเข้า CSV
              </Button>
            )}
          </div>
        )}
      </section>

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="flex min-h-0 w-[min(48%,520px)] shrink-0 flex-col card-surface">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-lg font-semibold">ตะกร้า</h2>
            <span className="text-xs text-slate-400">{cart.length} รายการ</span>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {cart.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">
                ตะกร้าว่าง — สแกนหรือค้นหาเพื่อเพิ่มสินค้า
              </p>
            )}
            {cart.map((line) => (
              <div
                key={line.product.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {line.product.name}
                    {isLow(line.product) && (
                      <span className="ml-2 text-xs text-amber-700">
                        สต็อกต่ำ
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatBaht(line.product.priceSatang)} / ชิ้น · เหลือ{" "}
                    {line.product.stockQty}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="!min-h-10 !w-10 !px-0"
                      onClick={() => setQty(line.product.id, line.qty - 1)}
                    >
                      −
                    </Button>
                    <NumberField
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(e) =>
                        setQty(line.product.id, Number(e.target.value) || 0)
                      }
                      aria-label={`จำนวน ${line.product.name}`}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="!min-h-10 !w-10 !px-0"
                      onClick={() => setQty(line.product.id, line.qty + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {formatBaht(line.product.priceSatang * line.qty)}
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-xs text-red-600 hover:underline"
                    onClick={() => setQty(line.product.id, 0)}
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 space-y-3 border-t border-slate-100 bg-white px-4 py-4">
            {warn && <Alert tone="warning">{warn}</Alert>}
            {error && <Alert tone="error">{error}</Alert>}
            <div className="flex justify-between text-2xl font-bold tracking-tight">
              <span>ยอดรวม</span>
              <span>{formatBaht(totalSatang)}</span>
            </div>
            <div className="min-w-0">
              <Input
                label="รับเงิน (บาท)"
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCheckout();
                  }
                }}
                inputMode="decimal"
                placeholder="0.00"
                size="lg"
                error={
                  paidSatang !== null &&
                  totalSatang > 0 &&
                  paidSatang < totalSatang
                    ? true
                    : null
                }
              />
              <div className="mt-2 flex flex-wrap gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPaidInput((totalSatang / 100).toFixed(2))}
                >
                  พอดี
                </Button>
                {DENOMS.map((d) => (
                  <Button
                    key={d}
                    variant="secondary"
                    size="sm"
                    onClick={() => addDenom(d)}
                  >
                    +{d}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-slate-600">เงินทอน</span>
              <span className="text-xl font-semibold text-emerald-700">
                {changeSatang !== null ? formatBaht(changeSatang) : "—"}
              </span>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!!payDisabledReason}
              onClick={() => void handleCheckout()}
              title={payDisabledReason ?? undefined}
            >
              {payDisabledReason && payDisabledReason !== "กำลังบันทึก…"
                ? payDisabledReason
                : busy
                  ? "กำลังบันทึก…"
                  : "ชำระเงินสด (F9)"}
            </Button>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col card-surface p-4">
          <div className="mb-1 flex min-w-0 items-end justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">
              เลือกสินค้า (คลิกเพิ่มลงตะกร้า)
            </span>
            <span className="shrink-0 text-xs text-slate-400">
              {browseProducts.length} รายการ
            </span>
          </div>
          <SearchField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="กรองชื่อหรือบาร์โค้ด (เว้นว่าง = แสดงทั้งหมด)"
            className="shrink-0"
          />
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {search.trim() && browseProducts.length === 0 && (
              <p className="text-sm text-slate-500">ไม่พบสินค้า</p>
            )}
            {pinnedProducts.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  ปักหมุด — คลิกเพิ่มเร็ว
                </h3>
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                  {pinnedProducts.map((p) => (
                    <ProductSellTile
                      key={p.id}
                      product={p}
                      pinnedHighlight
                      onAdd={handleTileAdd}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {gridProducts.map((p) => (
                <ProductSellTile
                  key={p.id}
                  product={p}
                  onAdd={handleTileAdd}
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="ล้างตะกร้า"
          message="ลบสินค้าทั้งหมดในตะกร้า?"
          confirmLabel="ล้างตะกร้า"
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            setCart([]);
            setPaidInput("");
            setError(null);
            setWarn(null);
            setConfirmClear(false);
            scanRef.current?.focus();
          }}
        />
      )}

      {receipt && (
        <ReceiptModal
          sale={receipt}
          shopName={settings.shopName}
          shopAddress={settings.shopAddress}
          onClose={() => {
            setReceipt(null);
            scanRef.current?.focus();
          }}
          onNewSale={() => {
            setReceipt(null);
            scanRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
