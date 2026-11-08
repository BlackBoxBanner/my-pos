import { useCallback, useEffect, useRef, useState } from "react";
import {
  backupDatabase,
  errorMessage,
  getDataDir,
  setManagerPin,
  setShopSettings,
  type ShopSettings,
} from "../lib/api";
import { useShop } from "../lib/shopContext";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Checkbox } from "../components/ui/Checkbox";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/StatCard";
import { Modal } from "../components/ui/Modal";
import { SettingsUpdateSection } from "../components/SettingsUpdateSection";

export function SettingsPage({ active }: { active?: boolean }) {
  const { settings, hasPin, refreshSettings, refreshStatus, isTauri } =
    useShop();
  const [form, setForm] = useState<ShopSettings>(settings);
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [pinMode, setPinMode] = useState<null | "set" | "change">(null);
  const [newPin, setNewPin] = useState("");
  const [oldPin, setOldPin] = useState("");

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

  const savePin = useCallback(async () => {
    await setManagerPin(newPin, pinMode === "change" ? oldPin : undefined);
    setPinMode(null);
    setNewPin("");
    setOldPin("");
    setMsg(pinMode === "change" ? "เปลี่ยน PIN แล้ว" : "ตั้งรหัสผู้จัดการแล้ว");
    await refreshStatus();
  }, [newPin, oldPin, pinMode, refreshStatus]);

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-4 overflow-y-auto">
      <PageHeader
        title="ตั้งค่า"
        subtitle="ร้านค้า · ความปลอดภัย · อัปเดต · สำรองข้อมูล"
      />

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
          onChange={(e) =>
            setForm({ ...form, soundEnabled: e.target.checked })
          }
        />
        <Button variant="primary" disabled={busy} onClick={() => void save()}>
          {busy ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
        </Button>
      </section>

      <section className="card-surface space-y-3 p-4">
        <h2 className="font-semibold text-slate-900">รหัสผู้จัดการ</h2>
        <p className="text-sm text-slate-500">
          ใช้สำหรับปรับสต็อก ปิดยอด และยกเลิกบิล
          {hasPin ? " — ตั้งค่าแล้ว" : " — ยังไม่ได้ตั้ง"}
        </p>
        <Button
          variant="secondary"
          onClick={() => setPinMode(hasPin ? "change" : "set")}
        >
          {hasPin ? "เปลี่ยน PIN" : "ตั้งรหัสผู้จัดการ"}
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

      {(pinMode === "set" || pinMode === "change") && (
        <Modal
          title={pinMode === "set" ? "ตั้งรหัสผู้จัดการ" : "เปลี่ยน PIN"}
          onClose={() => setPinMode(null)}
          footer={
            <>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setPinMode(null)}
              >
                ยกเลิก
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() =>
                  void savePin().catch((e) => setError(errorMessage(e)))
                }
              >
                บันทึก
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {pinMode === "change" && (
              <Input
                label="PIN เดิม"
                type="password"
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value)}
                autoComplete="off"
              />
            )}
            <Input
              label="PIN ใหม่ (≥ 4)"
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              autoComplete="off"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
