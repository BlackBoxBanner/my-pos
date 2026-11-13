import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

export function CheatsheetModal({ onClose }: { onClose: () => void }) {
  const rows = [
    ["Ctrl+1 … 5", "สลับแท็บ ขาย / สินค้า / สต็อก / รายงาน / ตั้งค่า"],
    ["Ctrl/Cmd +", "ซูมเข้า"],
    ["Ctrl/Cmd −", "ซูมออก"],
    ["Ctrl/Cmd 0", "รีเซ็ตซูม 100%"],
    ["Ctrl/Cmd + ล้อเมาส์", "ซูมเข้า / ออก"],
    ["Enter (ช่องสแกน)", "เพิ่มสินค้าจากบาร์โค้ด"],
    ["3*บาร์โค้ด", "เพิ่มจำนวน 3 ชิ้น"],
    ["F9", "ชำระเงินสด"],
    ["Esc", "ล้างตะกร้า (ยืนยัน)"],
    ["?", "เปิดคีย์ลัดนี้"],
  ];
  return (
    <Modal
      title="คีย์ลัด"
      onClose={onClose}
      footer={
        <Button variant="primary" className="w-full" onClick={onClose}>
          ปิด
        </Button>
      }
    >
      <table className="w-full text-left text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t border-slate-100">
              <td className="py-2 pr-3 font-mono text-xs text-emerald-700">
                {k}
              </td>
              <td className="py-2 text-slate-700">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
