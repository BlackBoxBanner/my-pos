import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauriRuntime } from "./shopContext";

export type UpdateCheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "uptodate" }
  | { status: "available"; update: Update }
  | { status: "downloading" }
  | { status: "error"; message: string };

export async function fetchAppVersion(): Promise<string> {
  if (!isTauriRuntime()) {
    return "—";
  }
  return getVersion();
}

function updaterMessage(error: unknown): string {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "ไม่สามารถตรวจสอบอัปเดตได้";
  const lower = text.toLowerCase();
  if (
    lower.includes("not configured") ||
    lower.includes("updater") && lower.includes("disabled") ||
    lower.includes("pubkey") ||
    lower.includes("endpoint")
  ) {
    return "ตัวอัปเดตอัตโนมัติยังไม่พร้อม — บิลด์ production ต้องตั้งค่า signing key และ latest.json (ดู README)";
  }
  return text;
}

export async function checkForAppUpdate(): Promise<Update | null> {
  if (!isTauriRuntime()) {
    throw new Error("ตรวจสอบอัปเดตได้เฉพาะในแอป Tauri");
  }
  try {
    return await check();
  } catch (e) {
    throw new Error(updaterMessage(e));
  }
}

export async function downloadAndInstallUpdate(update: Update): Promise<void> {
  await update.downloadAndInstall();
  await relaunch();
}
