export const UI_ZOOM_MIN = 10;
export const UI_ZOOM_MAX = 200;
export const UI_ZOOM_STEP = 10;
export const UI_ZOOM_DEFAULT = 100;
export const UI_ZOOM_STORAGE_KEY = "my-pos.uiZoom";

export function clampUiZoom(percent: number): number {
  if (!Number.isFinite(percent)) return UI_ZOOM_DEFAULT;
  const stepped = Math.round(percent / UI_ZOOM_STEP) * UI_ZOOM_STEP;
  return Math.min(UI_ZOOM_MAX, Math.max(UI_ZOOM_MIN, stepped));
}

export function readUiZoom(): number {
  try {
    const raw = localStorage.getItem(UI_ZOOM_STORAGE_KEY);
    if (raw == null) return UI_ZOOM_DEFAULT;
    return clampUiZoom(Number(raw));
  } catch {
    return UI_ZOOM_DEFAULT;
  }
}

export function writeUiZoom(percent: number): number {
  const next = clampUiZoom(percent);
  try {
    localStorage.setItem(UI_ZOOM_STORAGE_KEY, String(next));
  } catch {
    // Ignore quota / private-mode failures; CSS still applies.
  }
  return next;
}

/** Apply zoom CSS on `#root`. Pass a percent or read from storage. */
export function applyUiZoom(percent?: number): number {
  const next = clampUiZoom(percent ?? readUiZoom());
  const root = document.getElementById("root");
  if (root) {
    root.style.setProperty("--ui-zoom", String(next / 100));
  }
  return next;
}

export function setUiZoom(percent: number): number {
  const next = writeUiZoom(percent);
  return applyUiZoom(next);
}

export function stepUiZoom(deltaSteps: number, current?: number): number {
  const base = current ?? readUiZoom();
  return setUiZoom(base + deltaSteps * UI_ZOOM_STEP);
}
