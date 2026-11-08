import { Button } from "./Button";
import { Modal } from "./Modal";

type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  danger,
  busy,
  onCancel,
  onConfirm,
}: Props) {
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
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            className="flex-1"
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? "กำลังทำ…" : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}
