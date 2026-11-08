# POS UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark left sidebar with a light top bar, and make ขาย a scan-first page with a fixed checkout dock.

**Architecture:** `App.tsx` owns the shell and tab state. `SellPage` owns the barcode field, search, cart, and checkout dock. Products, stock, and reports already match the light card style and are not restyled. `index.css` and `ReceiptModal` stay as they are.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Vite, Tauri.

## Global Constraints

- Thai labels stay. Nav order is ขาย, สินค้า, สต็อก, รายงาน.
- Checkout, catalog, stock, and reports keep their current behavior and data.
- Desktop layout. Emerald is the only accent. Canvas stays light gray.
- The checkout dock exists only on ขาย and is about 400px wide.
- No new features, keyboard shortcuts, API changes, database changes, or receipt content changes.
- There is no UI test suite. Do not add one.
- Do not edit `src/index.css`, `src/components/ReceiptModal.tsx`, `src/lib/api.ts`, or `src/lib/money.ts`.

---

## File structure

- Modify: `src/App.tsx` — light top bar. Tab state and the pending-barcode handoff stay.
- Modify: `src/pages/SellPage.tsx` — barcode field full width on top; search on the left; checkout dock on the right. Scan, cart, and checkout functions stay.
- Unchanged: `src/pages/ProductsPage.tsx`, `src/pages/StockPage.tsx`, `src/pages/ReportsPage.tsx`, `src/components/ReceiptModal.tsx`, `src/index.css`.

### Task 1: Light top bar

**Files:**

- Modify: `src/App.tsx`

**Interfaces:**

- Consumes: `SellPage` prop `onAddProduct?: (barcode: string) => void`. `ProductsPage` props `initialBarcode?: string | null` and `onConsumedBarcode?: () => void`.
- Produces: the same `Tab` union `"sell" | "products" | "stock" | "reports"`, `goAddProduct(barcode: string)`, and `consumeBarcode()`. No new exports.

- [ ] **Step 1: Replace the sidebar shell**

Replace the `return` in `src/App.tsx` with:

```tsx
return (
  <div className="flex h-full min-h-0 flex-col bg-slate-100">
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4">
      <div className="mr-2 text-base font-bold tracking-wide text-slate-900">
        My POS
      </div>
      {NAV.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setTab(item.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            tab === item.id
              ? "bg-emerald-50 text-emerald-700"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          {item.label}
        </button>
      ))}
    </header>

    <main className="min-h-0 min-w-0 flex-1 p-4">
      {tab === "sell" && <SellPage onAddProduct={goAddProduct} />}
      {tab === "products" && (
        <ProductsPage
          initialBarcode={pendingBarcode}
          onConsumedBarcode={consumeBarcode}
        />
      )}
      {tab === "stock" && <StockPage />}
      {tab === "reports" && <ReportsPage />}
    </main>
  </div>
);
```

Leave `NAV`, `goAddProduct`, and `consumeBarcode` unchanged. Delete the dark `nav` sidebar. Do not add a subtitle.

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: exit 0. `tsc` and `vite build` both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace the sidebar with a light top bar"
```

### Task 2: Scan-first checkout dock

**Files:**

- Modify: `src/pages/SellPage.tsx` (the `return` starting at the `flex h-full` wrapper)

**Interfaces:**

- Consumes: existing `scanRef`, `scan`, `handleScan`, `unknownBarcode`, `onAddProduct`, `search`, `results`, `addToCart`, `cart`, `setQty`, `error`, `totalSatang`, `paidInput`, `changeSatang`, `busy`, `handleCheckout`, `receipt`, `formatBaht`.
- Produces: no new props or exports. `SellPage` still accepts `{ onAddProduct?: (barcode: string) => void }`.

- [ ] **Step 1: Restack the sell layout**

Keep every handler and effect. Replace only the returned tree so the barcode field is the first block, then a row of search and dock.

```tsx
return (
  <div className="flex h-full min-h-0 flex-col gap-4">
    <section className="shrink-0 rounded-2xl bg-white p-4 shadow-sm">
      <label className="mb-1 block text-sm font-medium text-slate-700">
        สแกนบาร์โค้ด
      </label>
      <input
        ref={scanRef}
        value={scan}
        onChange={(e) => setScan(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void handleScan();
          }
        }}
        placeholder="สแกนหรือพิมพ์บาร์โค้ดแล้วกด Enter"
        className="w-full rounded-xl border border-emerald-300 px-3 py-2.5 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
      />
      {unknownBarcode && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>ไม่พบบาร์โค้ด {unknownBarcode}</span>
          {onAddProduct && (
            <button
              type="button"
              className="rounded-lg bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-700"
              onClick={() => onAddProduct(unknownBarcode)}
            >
              เพิ่มสินค้า
            </button>
          )}
        </div>
      )}
    </section>

    <div className="flex min-h-0 flex-1 gap-4">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl bg-white p-4 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          ค้นหาชื่อสินค้า
        </label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="พิมพ์ชื่อสินค้า"
          className="w-full shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />
        <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
          {search.trim() && results.length === 0 && (
            <p className="text-sm text-slate-500">ไม่พบสินค้า</p>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addToCart(p)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50"
            >
              <div>
                <div className="font-medium text-slate-800">{p.name}</div>
                <div className="text-xs text-slate-500">
                  สต็อก {p.stockQty}
                  {p.barcode ? ` · ${p.barcode}` : ""}
                </div>
              </div>
              <div className="font-medium text-emerald-700">
                {formatBaht(p.priceSatang)}
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="flex w-[400px] shrink-0 flex-col rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold">ชำระเงิน</h2>
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
                <div className="truncate font-medium">{line.product.name}</div>
                <div className="text-xs text-slate-500">
                  {formatBaht(line.product.priceSatang)} / ชิ้น
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="h-8 w-8 rounded-lg border border-slate-300 text-lg leading-none hover:bg-slate-50"
                    onClick={() => setQty(line.product.id, line.qty - 1)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(e) =>
                      setQty(line.product.id, Number(e.target.value) || 0)
                    }
                    className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm"
                  />
                  <button
                    type="button"
                    className="h-8 w-8 rounded-lg border border-slate-300 text-lg leading-none hover:bg-slate-50"
                    onClick={() => setQty(line.product.id, line.qty + 1)}
                  >
                    +
                  </button>
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

        <div className="space-y-3 border-t border-slate-100 px-4 py-4">
          {error && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-between text-lg font-semibold">
            <span>ยอดรวม</span>
            <span>{formatBaht(totalSatang)}</span>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              รับเงิน (บาท)
            </label>
            <input
              value={paidInput}
              onChange={(e) => setPaidInput(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>เงินทอน</span>
            <span className="font-medium text-emerald-700">
              {changeSatang !== null ? formatBaht(changeSatang) : "—"}
            </span>
          </div>
          <button
            type="button"
            disabled={busy || cart.length === 0}
            onClick={() => void handleCheckout()}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? "กำลังบันทึก…" : "ชำระเงินสด"}
          </button>
        </div>
      </aside>
    </div>

    {receipt && (
      <ReceiptModal
        sale={receipt}
        onClose={() => setReceipt(null)}
        onNewSale={() => {
          setReceipt(null);
          scanRef.current?.focus();
        }}
      />
    )}
  </div>
);
```

Do not change `handleScan`, `addToCart`, `setQty`, or `handleCheckout`. The existing mount effect and the `finally` in `handleCheckout` already focus `scanRef`.

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/pages/SellPage.tsx
git commit -m "feat: put checkout in a fixed dock under a full-width scan field"
```

### Task 3: Check the four pages

**Files:**

- No source edits unless a check below fails. If it fails, fix only that mismatch.

**Interfaces:**

- Consumes: the shell from Task 1 and the sell layout from Task 2.
- Produces: nothing.

- [ ] **Step 1: Confirm back office was not given a dock**

Run:

```bash
rg -n "ชำระเงินสด|w-\[400px\]" src/pages/ProductsPage.tsx src/pages/StockPage.tsx src/pages/ReportsPage.tsx
```

Expected: no matches.

- [ ] **Step 2: Build**

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 3: Manual check**

Run: `npm run dev`

Expected in the browser:

- The top bar shows My POS, then ขาย, สินค้า, สต็อก, รายงาน. The active item is emerald text on an emerald tint. There is no dark left sidebar.
- On ขาย, the barcode field is first and focused. Enter on a known barcode adds a line in the right dock. An unknown barcode shows ไม่พบบาร์โค้ด and เพิ่มสินค้า.
- Name search adds a product. Quantity, ลบ, ยอดรวม, รับเงิน, เงินทอน, and ชำระเงินสด work. A successful checkout opens ใบเสร็จ. ขายต่อ returns focus to the barcode field.
- สินค้า, สต็อก, and รายงาน have no checkout dock. Product search, เพิ่มสินค้า, the product modal, stock receive/adjust, and ปิดยอดวันนี้ still work.
- เพิ่มสินค้า from an unknown barcode opens สินค้า with that barcode in the form.
