import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Modal } from "./ui/Modal";

type Props = {
  title: string;
  message?: string;
  onCancel: () => void;
  onConfirm: (pin: string) => void | Promise<void>;
};

export function PinModal({ title, message, onCancel, onConfirm }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (busyRef.current) return;
    if (!pin.trim()) {
      setError("กรุณากรอกรหัส PIN");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(pin.trim());
    } catch (e) {
      setError(
        typeof e === "string"
          ? e
          : e instanceof Error
            ? e.message
            : "รหัสไม่ถูกต้อง",
      );
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onCancel}
            disabled={busy}
          >
            ยกเลิก
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "กำลังตรวจ…" : "ยืนยัน"}
          </Button>
        </>
      }
    >
      {message && <p className="mb-3 text-sm text-slate-500">{message}</p>}
      <Input
        ref={inputRef}
        label="รหัสผู้จัดการ"
        type="password"
        inputMode="numeric"
        value={pin}
        error={error}
        onChange={(e) => {
          setPin(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        autoComplete="off"
      />
    </Modal>
  );
}
