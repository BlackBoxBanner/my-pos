import { useCallback, useEffect, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import {
  checkForAppUpdate,
  downloadAndInstallUpdate,
  fetchAppVersion,
  type UpdateCheckState,
} from "../lib/updater";
import { errorMessage } from "../lib/api";

type Props = {
  active?: boolean;
  isTauri: boolean;
};

export function SettingsUpdateSection({ active, isTauri }: Props) {
  const [version, setVersion] = useState<string | null>(null);
  const [state, setState] = useState<UpdateCheckState>({ status: "idle" });
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);

  useEffect(() => {
    if (!active) return;
    void fetchAppVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, [active, isTauri]);

  const runCheck = useCallback(async () => {
    if (!isTauri) {
      setState({
        status: "error",
        message: "ตรวจสอบอัปเดตได้เมื่อรันผ่านแอป Tauri เท่านั้น",
      });
      return;
    }
    setState({ status: "checking" });
    setPendingUpdate(null);
    try {
      const update = await checkForAppUpdate();
      if (update) {
        setPendingUpdate(update);
        setState({ status: "available", update });
      } else {
        setState({ status: "uptodate" });
      }
    } catch (e) {
      setState({ status: "error", message: errorMessage(e) });
    }
  }, [isTauri]);

  const runInstall = useCallback(async () => {
    const update = pendingUpdate;
    if (!update) return;
    setState({ status: "downloading" });
    try {
      await downloadAndInstallUpdate(update);
    } catch (e) {
      setState({ status: "error", message: errorMessage(e) });
    }
  }, [pendingUpdate]);

  const versionLabel = version ?? (isTauri ? "…" : "เว็บ (ไม่มีเวอร์ชันแอป)");

  return (
    <section className="card-surface space-y-3 p-4">
      <h2 className="font-semibold text-slate-900">อัปเดต</h2>
      <Field label="เวอร์ชันปัจจุบัน">
        <p className="text-sm font-medium text-slate-800">v{versionLabel}</p>
      </Field>

      {state.status === "checking" && (
        <p className="text-sm text-slate-500">กำลังตรวจสอบอัปเดต…</p>
      )}
      {state.status === "uptodate" && (
        <p className="text-sm text-emerald-700">ใช้งานเวอร์ชันล่าสุดแล้ว</p>
      )}
      {state.status === "available" && pendingUpdate && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-800">
            พบเวอร์ชันใหม่{" "}
            <span className="font-semibold">v{pendingUpdate.version}</span>
          </p>
          {pendingUpdate.body?.trim() && (
            <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs text-slate-600">
              {pendingUpdate.body}
            </pre>
          )}
        </div>
      )}
      {state.status === "downloading" && (
        <p className="text-sm text-slate-500">กำลังดาวน์โหลดและติดตั้ง… แอปจะเริ่มใหม่</p>
      )}
      {state.status === "error" && (
        <p className="text-sm text-red-600" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={state.status === "checking" || state.status === "downloading"}
          onClick={() => void runCheck()}
        >
          {state.status === "checking" ? "กำลังตรวจสอบ…" : "ตรวจสอบอัปเดต"}
        </Button>
        {state.status === "available" && pendingUpdate && (
          <Button
            variant="primary"
            onClick={() => void runInstall()}
          >
            ดาวน์โหลดและติดตั้ง
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        อัปเดตจาก GitHub Releases — ต้องลงชื่อแพ็กเกจ (signing) ใน CI ก่อนใช้งานจริง
      </p>
    </section>
  );
}
