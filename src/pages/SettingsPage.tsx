import { useEffect, useRef, useState } from "react";
import {
  backupDatabase,
  errorMessage,
  getDataDir,
  setShopSettings,
  type ShopSettings,
} from "../lib/api";
import { useShop } from "../lib/shopContext";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Checkbox } from "../components/ui/Checkbox";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/StatCard";
import { SettingsUpdateSection } from "../components/SettingsUpdateSection";

export function SettingsPage({ active }: { active?: boolean }) {
  const { settings, refreshSettings, isTauri } = useShop();
  const [form, setForm] = useState<ShopSettings>(settings);
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    if (!active || !isTauri) return;
    void getDataDir()
      .then(setDataDir)
      .catch(() => setDataDir(null));
  }, [active, isTauri]);

  const save = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const next = await setShopSettings(form);
      setForm(next);
      await refreshSettings();
      setMsg("บันทึกการตั้งค่าแล้ว");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const doBackup = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const path = await backupDatabase();
      setMsg(`สำรองข้อมูลแล้ว: ${path}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-4 overflow-y-auto">
      <PageHeader title="ตั้งค่า" subtitle="ร้านค้า · อัปเดต · สำรองข้อมูล" />

      {error && <Alert tone="error">{error}</Alert>}
      {msg && <Alert tone="success">{msg}</Alert>}

      <section className="card-surface space-y-3 p-4">
        <h2 className="font-semibold text-slate-900">ใบเสร็จ / ร้าน</h2>
        <Input
          label="ชื่อร้าน"
          value={form.shopName}
          onChange={(e) => setForm({ ...form, shopName: e.target.value })}
        />
        <Input
          label="ที่อยู่ (แสดงบนใบเสร็จ)"
          value={form.shopAddress}
          onChange={(e) => setForm({ ...form, shopAddress: e.target.value })}
        />
        <Checkbox
          label="พิมพ์ใบเสร็จอัตโนมัติหลังชำระเงิน"
          checked={form.autoPrint}
          onChange={(e) => setForm({ ...form, autoPrint: e.target.checked })}
        />
        <Checkbox
          label="เสียงแจ้งเตือนเมื่อขายสำเร็จ / ผิดพลาด"
          checked={form.soundEnabled}
          onChange={(e) => setForm({ ...form, soundEnabled: e.target.checked })}
        />
        <Button variant="primary" disabled={busy} onClick={() => void save()}>
          {busy ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
        </Button>
      </section>

      <SettingsUpdateSection active={active} isTauri={isTauri} />

      <section className="card-surface space-y-3 p-4">
        <h2 className="font-semibold text-slate-900">ข้อมูล</h2>
        {dataDir && (
          <p className="break-all text-xs text-slate-500">
            โฟลเดอร์ข้อมูล: {dataDir}
          </p>
        )}
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void doBackup()}
        >
          สำรองฐานข้อมูล
        </Button>
        <p className="text-xs text-slate-500">
          กู้คืน: ปิดแอปแล้วแทนที่ไฟล์ pos.db ด้วยไฟล์ใน backups/
        </p>
      </section>
    </div>
  );
}
