import { useCallback, useEffect, useRef, useState } from "react";
import {
  createProduct,
  deleteProduct,
  errorMessage,
  exportProductsCsv,
  importProducts,
  listProductsPage,
  setProductPinned,
  updateProduct,
  type CreateProductInput,
  type Product,
  type UpdateProductInput,
} from "../lib/api";
import { downloadProductCsvTemplate, parseProductCsv } from "../lib/csvImport";
import { formatBaht, parseBahtInput } from "../lib/money";
import { useShop } from "../lib/shopContext";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Checkbox } from "../components/ui/Checkbox";
import { Input } from "../components/ui/Input";
import { SearchField } from "../components/ui/SearchField";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EditableProductsTable } from "../components/EditableProductsTable";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useProductRowAutoSave } from "../hooks/useProductRowAutoSave";

type FormState = {
  name: string;
  barcode: string;
  priceBaht: string;
  stockQty: string;
  lowStockQty: string;
  active: boolean;
};

const emptyForm = (barcode = ""): FormState => ({
  name: "",
  barcode,
  priceBaht: "0.00",
  stockQty: "0",
  lowStockQty: "5",
  active: true,
});

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

type Props = {
  initialBarcode?: string | null;
  onConsumedBarcode?: () => void;
};

export function ProductsPage({ initialBarcode, onConsumedBarcode }: Props) {
  const { refreshStatus } = useShop();
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [showForm, setShowForm] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewRows, setPreviewRows] = useState<CreateProductInput[] | null>(
    null,
  );
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const debouncedQuery = useDebouncedValue(query, 300);

  const {
    patchProduct,
    flushSaveNow,
    syncCommittedFromServer,
    savingIds,
    rowErrors,
  } = useProductRowAutoSave(products, setProducts, () => {
    void refreshStatus();
  });

  const load = useCallback(
    async (pageIndex = page) => {
      try {
        const result = await listProductsPage(
          debouncedQuery || undefined,
          includeInactive,
          pageSize,
          pageIndex * pageSize,
        );
        const lastPage = Math.max(0, Math.ceil(result.total / pageSize) - 1);
        if (result.total > 0 && pageIndex > lastPage) {
          setPage(lastPage);
          return;
        }
        setProducts(result.items);
        syncCommittedFromServer(result.items);
        setTotalProducts(result.total);
        void refreshStatus();
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    [
      debouncedQuery,
      includeInactive,
      page,
      pageSize,
      refreshStatus,
      syncCommittedFromServer,
    ],
  );

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, includeInactive]);

  useEffect(() => {
    void load(page);
  }, [debouncedQuery, includeInactive, page, pageSize, load]);

  useEffect(() => {
    if (initialBarcode) {
      setEditing(null);
      setForm(emptyForm(initialBarcode));
      setShowForm(true);
      onConsumedBarcode?.();
    }
  }, [initialBarcode, onConsumedBarcode]);

  const pageCount = Math.max(1, Math.ceil(totalProducts / pageSize));
  const rangeStart = totalProducts === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min(totalProducts, (page + 1) * pageSize);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setShowForm(true);
  };

  const toCreateInput = (): CreateProductInput | null => {
    const priceSatang = parseBahtInput(form.priceBaht);
    if (priceSatang === null) {
      setError("ราคาสินค้าไม่ถูกต้อง");
      return null;
    }
    const stockQty = Number(form.stockQty);
    const lowStockQty = Number(form.lowStockQty);
    if (!Number.isInteger(stockQty) || stockQty < 0) {
      setError("จำนวนสต็อกต้องเป็นจำนวนเต็มไม่ติดลบ");
      return null;
    }
    if (!Number.isInteger(lowStockQty) || lowStockQty < 0) {
      setError("เกณฑ์สต็อกต่ำต้องเป็นจำนวนเต็มไม่ติดลบ");
      return null;
    }
    return {
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      priceSatang,
      stockQty,
      lowStockQty,
      active: form.active,
    };
  };

  const toUpdateInput = (): UpdateProductInput | null => {
    const priceSatang = parseBahtInput(form.priceBaht);
    if (priceSatang === null) {
      setError("ราคาสินค้าไม่ถูกต้อง");
      return null;
    }
    const lowStockQty = Number(form.lowStockQty);
    if (!Number.isInteger(lowStockQty) || lowStockQty < 0) {
      setError("เกณฑ์สต็อกต่ำต้องเป็นจำนวนเต็มไม่ติดลบ");
      return null;
    }
    return {
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      priceSatang,
      lowStockQty,
      active: form.active,
    };
  };

  const handleImportFile = async (file: File) => {
    setError(null);
    setImportMsg(null);
    try {
      const text = await file.text();
      const parsed = parseProductCsv(text);
      setPreviewRows(parsed.rows);
      setPreviewErrors(parsed.errors);
      if (parsed.rows.length === 0 && parsed.errors.length) {
        setError(parsed.errors[0]);
        setPreviewRows(null);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const commitImport = async () => {
    if (!previewRows?.length || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await importProducts(previewRows);
      const parts = [`สร้างใหม่ ${result.created}`, `อัปเดต ${result.updated}`];
      const allErrors = [...previewErrors, ...result.errors];
      if (allErrors.length) {
        parts.push(`ผิดพลาด ${allErrors.length}`);
        setError(allErrors.slice(0, 8).join(" · "));
      }
      setImportMsg(parts.join(" · "));
      setPreviewRows(null);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const doExport = async () => {
    try {
      const csv = await exportProductsCsv(includeInactive);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "products-export.csv";
      a.click();
      URL.revokeObjectURL(url);
      setImportMsg("ส่งออก CSV แล้ว");
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const save = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        const input = toUpdateInput();
        if (!input) return;
        await updateProduct(editing.id, input);
      } else {
        const input = toCreateInput();
        if (!input) return;
        await createProduct(input);
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const togglePin = async (p: Product) => {
    setError(null);
    const nextPinned = !p.pinned;
    setProducts((prev) =>
      prev.map((row) =>
        row.id === p.id ? { ...row, pinned: nextPinned } : row,
      ),
    );
    try {
      const updated = await setProductPinned(p.id, nextPinned);
      setProducts((prev) => {
        const next = prev.map((row) => (row.id === p.id ? updated : row));
        syncCommittedFromServer(next);
        return next;
      });
      void refreshStatus();
    } catch (e) {
      setProducts((prev) =>
        prev.map((row) =>
          row.id === p.id ? { ...row, pinned: p.pinned } : row,
        ),
      );
      setError(errorMessage(e));
    }
  };

  const requestDelete = (p: Product) => {
    setError(null);
    setDeleteTarget(p);
  };

  const performDelete = async () => {
    if (!deleteTarget || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await deleteProduct(deleteTarget.id);
      setDeleteTarget(null);
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <SearchField
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="ค้นหาสินค้าหรือบาร์โค้ด"
        />
        <Checkbox
          className="shrink-0 text-slate-600"
          label="แสดงสินค้าที่ปิดการขาย"
          checked={includeInactive}
          onChange={(e) => {
            setIncludeInactive(e.target.checked);
            setPage(0);
          }}
        />
        <Button
          variant="secondary"
          onClick={() => downloadProductCsvTemplate()}
        >
          ตัวอย่าง CSV
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          นำเข้า CSV
        </Button>
        <Button variant="secondary" onClick={() => void doExport()}>
          ส่งออก CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportFile(file);
          }}
        />
        <Button variant="primary" onClick={openCreate}>
          เพิ่มสินค้า
        </Button>
      </div>

      {importMsg && <Alert tone="success">{importMsg}</Alert>}
      {error && !showForm && <Alert tone="error">{error}</Alert>}

      {totalProducts === 0 && !query && (
        <div className="card-surface flex flex-col items-center gap-3 p-10 text-center">
          <h2 className="text-lg font-semibold">ยังไม่มีสินค้า</h2>
          <ol className="list-decimal space-y-1 pl-5 text-left text-sm text-slate-600">
            <li>ดาวน์โหลดตัวอย่าง CSV</li>
            <li>กรอกสินค้าแล้วกดนำเข้า CSV</li>
            <li>ไปแท็บขายเพื่อเริ่มขาย</li>
          </ol>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => downloadProductCsvTemplate()}
            >
              ดาวน์โหลดตัวอย่าง
            </Button>
            <Button variant="primary" onClick={openCreate}>
              เพิ่มสินค้า
            </Button>
          </div>
        </div>
      )}

      {totalProducts > 0 && (
        <div className="min-h-0 flex-1 overflow-auto card-surface">
          <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
            แก้ไขในตารางได้เลย — บันทึกอัตโนมัติหลังหยุดพิมพ์หรือเมื่อออกจากช่อง
          </p>
          <EditableProductsTable
            rows={products}
            savingIds={savingIds}
            rowErrors={rowErrors}
            onPatch={patchProduct}
            onFlushSave={flushSaveNow}
            onTogglePin={(p) => void togglePin(p)}
            onDelete={requestDelete}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-500">
              แสดง {rangeStart}–{rangeEnd} จาก {totalProducts} รายการ · หน้า{" "}
              {page + 1}/{pageCount}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-slate-600">
                <span className="text-sm">ต่อหน้า</span>
                <Select
                  controlSize="sm"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(0);
                  }}
                  className="!w-auto min-w-[4.5rem]"
                  aria-label="จำนวนต่อหน้า"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  ก่อนหน้า
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  ถัดไป
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewRows && (
        <Modal
          title="ยืนยันนำเข้า CSV"
          wide
          onClose={() => setPreviewRows(null)}
          footer={
            <>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setPreviewRows(null)}
              >
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={busy || previewRows.length === 0}
                onClick={() => void commitImport()}
              >
                {busy ? "กำลังนำเข้า…" : `นำเข้า ${previewRows.length} แถว`}
              </Button>
            </>
          }
        >
          {previewErrors.length > 0 && (
            <Alert tone="warning" className="mb-3">
              พบปัญหาตอนอ่านไฟล์ {previewErrors.length} รายการ —{" "}
              {previewErrors.slice(0, 3).join(" · ")}
            </Alert>
          )}
          <p className="mb-2 text-sm text-slate-600">
            ตัวอย่าง {Math.min(20, previewRows.length)} แถวแรกจากทั้งหมด{" "}
            {previewRows.length}
          </p>
          <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-2">ชื่อ</th>
                  <th className="px-2 py-2">บาร์โค้ด</th>
                  <th className="px-2 py-2">ราคา</th>
                  <th className="px-2 py-2">สต็อก</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1">{r.name}</td>
                    <td className="px-2 py-1">{r.barcode ?? "—"}</td>
                    <td className="px-2 py-1">{formatBaht(r.priceSatang)}</td>
                    <td className="px-2 py-1">{r.stockQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {showForm && (
        <Modal
          title={editing ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
          onClose={() => setShowForm(false)}
          footer={
            <>
              {editing && (
                <Button
                  variant="danger"
                  onClick={() => requestDelete(editing)}
                  disabled={busy}
                >
                  ลบสินค้า
                </Button>
              )}
              <div className="flex flex-1 gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowForm(false)}
                >
                  ยกเลิก
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {busy ? "กำลังบันทึก…" : "บันทึก"}
                </Button>
              </div>
            </>
          }
        >
          <div className="space-y-3">
            {error && <Alert tone="error">{error}</Alert>}
            <Input
              label="ชื่อสินค้า"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="บาร์โค้ด"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="ราคา (บาท)"
                value={form.priceBaht}
                onChange={(e) =>
                  setForm({ ...form, priceBaht: e.target.value })
                }
                inputMode="decimal"
              />
              <Input
                label="สต็อกเริ่มต้น"
                value={form.stockQty}
                onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
                inputMode="numeric"
                disabled={!!editing}
              />
            </div>
            {editing && (
              <p className="text-xs text-slate-500">
                ปรับสต็อกผ่านหน้า “สต็อก”
              </p>
            )}
            <Input
              label="เกณฑ์สต็อกต่ำ"
              value={form.lowStockQty}
              onChange={(e) =>
                setForm({ ...form, lowStockQty: e.target.value })
              }
              inputMode="numeric"
            />
            <Checkbox
              label="เปิดขาย"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="ลบสินค้า"
          message={`ลบ “${deleteTarget.name}” ถาวร? ไม่สามารถกู้คืนได้ หากเคยขายแล้วระบบจะไม่อนุญาต — ให้ปิดการขายแทน`}
          confirmLabel="ลบ"
          danger
          busy={busy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void performDelete()}
        />
      )}
    </div>
  );
}
