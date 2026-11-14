import { useEffect, useRef, useState } from "react";
import {
  closeDay,
  errorMessage,
  getSale,
  getTodayReport,
  listDayCloses,
  voidSale,
  type DayClose,
  type Sale,
  type TodayReport,
} from "../lib/api";
import { formatBaht } from "../lib/money";
import { formatTime } from "../lib/datetime";
import { useShop } from "../lib/shopContext";
import { ReceiptModal } from "../components/ReceiptModal";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { StatCard } from "../components/ui/StatCard";

export function ReportsPage({ active }: { active?: boolean }) {
  const { settings, refreshStatus } = useShop();
  const [report, setReport] = useState<TodayReport | null>(null);
  const [closes, setCloses] = useState<DayClose[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);
  const [voidTargetId, setVoidTargetId] = useState<number | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const load = async () => {
    try {
      const [r, c] = await Promise.all([getTodayReport(), listDayCloses()]);
      setReport(r);
      setCloses(c);
      void refreshStatus();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  useEffect(() => {
    if (active !== false) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const handleCloseDay = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setCloseMsg(null);
    try {
      const result = await closeDay();
      setCloseMsg(
        `ปิดยอดวันที่ ${result.businessDate} แล้ว — ${result.saleCount} บิล รวม ${formatBaht(result.totalSatang)}`,
      );
      setConfirmClose(false);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const openSale = async (id: number) => {
    try {
      setReceipt(await getSale(id));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const handleVoid = async () => {
    if (voidTargetId == null || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const sale = await voidSale(voidTargetId);
      setReceipt(sale);
      setVoidTargetId(null);
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
      {error && <Alert tone="error">{error}</Alert>}
      {closeMsg && <Alert tone="success">{closeMsg}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="วันที่ (กรุงเทพฯ)"
          value={report?.businessDate ?? "—"}
        />
        <StatCard
          label="จำนวนบิลวันนี้"
          value={String(report?.saleCount ?? 0)}
        />
        <StatCard
          label="ยอดขายวันนี้"
          value={formatBaht(report?.totalSatang ?? 0)}
        />
      </div>

      {report?.dayClosed && (
        <Alert tone="warning">
          ปิดยอดวันนี้แล้ว — ไม่สามารถขายเพิ่มได้ (อัปเดตยอดปิดซ้ำได้)
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => setConfirmClose(true)}
        >
          ปิดยอดวันนี้
        </Button>
        <Button variant="secondary" onClick={() => void load()}>
          รีเฟรช
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <section className="min-h-0 overflow-auto card-surface">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-lg font-semibold">ใบเสร็จวันนี้</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">เลขที่</th>
                <th className="px-4 py-3 font-medium">เวลา</th>
                <th className="px-4 py-3 font-medium">ยอด</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(report?.sales.length ?? 0) === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    ยังไม่มีการขายวันนี้
                  </td>
                </tr>
              )}
              {report?.sales.map((s) => {
                const voided = s.status === "voided";
                return (
                  <tr
                    key={s.id}
                    className={`border-t border-slate-100 ${
                      voided
                        ? "bg-slate-50 text-slate-400 line-through"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td
                      className={`cursor-pointer px-4 py-3 font-medium ${
                        voided ? "" : "text-emerald-700"
                      }`}
                      onClick={() => void openSale(s.id)}
                    >
                      {s.receiptNo}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-3"
                      onClick={() => void openSale(s.id)}
                    >
                      {formatTime(s.createdAt)}
                    </td>
                    <td
                      className="cursor-pointer px-4 py-3"
                      onClick={() => void openSale(s.id)}
                    >
                      {formatBaht(s.totalSatang)}
                    </td>
                    <td className="px-4 py-3">
                      {voided ? (
                        <span className="text-red-600 no-underline">
                          ยกเลิก
                        </span>
                      ) : (
                        <span className="text-slate-600">ปกติ</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!voided && (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => setVoidTargetId(s.id)}
                        >
                          ยกเลิก
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="min-h-0 overflow-auto card-surface">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-lg font-semibold">ประวัติปิดยอด</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">วันที่</th>
                <th className="px-4 py-3 font-medium">บิล</th>
                <th className="px-4 py-3 font-medium">ยอด</th>
                <th className="px-4 py-3 font-medium">ปิดเมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {closes.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    ยังไม่มีการปิดยอด
                  </td>
                </tr>
              )}
              {closes.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{c.businessDate}</td>
                  <td className="px-4 py-3">{c.saleCount}</td>
                  <td className="px-4 py-3">{formatBaht(c.totalSatang)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatTime(c.closedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {receipt && (
        <ReceiptModal
          sale={receipt}
          shopName={settings.shopName}
          shopAddress={settings.shopAddress}
          onClose={() => setReceipt(null)}
          onNewSale={() => setReceipt(null)}
          onVoid={
            receipt.status !== "voided"
              ? () => setVoidTargetId(receipt.id)
              : undefined
          }
        />
      )}

      {confirmClose && report && (
        <ConfirmDialog
          title="ยืนยันปิดยอดวันนี้"
          message={`ปิดยอดวันที่ ${report.businessDate} — ${report.saleCount} บิล รวม ${formatBaht(report.totalSatang)} แล้วล็อกการขายวันนี้?`}
          confirmLabel="ปิดยอด"
          busy={busy}
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => void handleCloseDay()}
        />
      )}

      {voidTargetId != null && (
        <ConfirmDialog
          title="ยกเลิกใบเสร็จ"
          message="จะคืนสต็อกทั้งหมดของบิลนี้"
          confirmLabel="ยกเลิกบิล"
          danger
          busy={busy}
          onCancel={() => setVoidTargetId(null)}
          onConfirm={() => void handleVoid()}
        />
      )}
    </div>
  );
}
