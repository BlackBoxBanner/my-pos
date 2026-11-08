import { useState } from "react";
import { setManagerPin, setShopSettings, errorMessage } from "../lib/api";
import { useShop } from "../lib/shopContext";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";

type Props = {
  onDone: () => void;
  onGoImport: () => void;
};

export function OnboardingWizard({ onDone, onGoImport }: Props) {
  const { settings, refreshSettings, refreshStatus } = useShop();
  const [step, setStep] = useState(0);
  const [shopName, setShopName] = useState(settings.shopName || "My POS");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async (skipPin: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (!skipPin) {
        if (pin.trim().length < 4) {
          setError("รหัส PIN ต้องมีอย่างน้อย 4 ตัวอักษ");
          setBusy(false);
          return;
        }
        await setManagerPin(pin.trim());
      }
      await setShopSettings({
        ...settings,
        shopName: shopName.trim() || "My POS",
        onboardingDone: true,
      });
      await refreshSettings();
      await refreshStatus();
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="เริ่มต้นใช้งาน My POS" onClose={() => void finish(true)}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {step === 0 && (
          <>
            <p className="text-sm text-slate-600">
              ตั้งชื่อร้าน ตั้งรหัสผู้จัดการ แล้วนำเข้าสินค้าได้ทันที
            </p>
            <Input
              label="ชื่อร้าน"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
            />
            <Button
              variant="primary"
              className="w-full"
              onClick={() => setStep(1)}
            >
              ถัดไป
            </Button>
          </>
        )}
        {step === 1 && (
          <>
            <p className="text-sm text-slate-600">
              รหัสนี้ใช้ปิดยอด ปรับสต็อก และยกเลิกบิล
            </p>
            <Input
              label="รหัสผู้จัดการ (≥ 4)"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="off"
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setStep(0)}
              >
                ย้อนกลับ
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={busy}
                onClick={() => setStep(2)}
              >
                ถัดไป
              </Button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>นำเข้าสินค้าจาก CSV หรือเพิ่มทีละรายการ</li>
              <li>ไปแท็บขาย สแกนบาร์โค้ด แล้วกด F9 เพื่อชำระ</li>
              <li>ปิดยอดท้ายวันที่แท็บรายงาน</li>
            </ol>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  void finish(false).then(() => onGoImport());
                }}
              >
                นำเข้า CSV เลย
              </Button>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void finish(false)}
              >
                {busy ? "กำลังบันทึก…" : "เริ่มขาย"}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void finish(true)}
              >
                ข้ามการตั้ง PIN ไว้ก่อน
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
