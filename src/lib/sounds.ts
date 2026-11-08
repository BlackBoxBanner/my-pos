/** Simple Web Audio beeps for POS feedback (no assets). */

function beep(freq: number, durationMs: number, volume = 0.08) {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.stop(ctx.currentTime + durationMs / 1000);
    setTimeout(() => void ctx.close(), durationMs + 50);
  } catch {
    /* ignore */
  }
}

export function playSuccessSound(enabled: boolean) {
  if (!enabled) return;
  beep(880, 80);
  setTimeout(() => beep(1175, 100), 90);
}

export function playErrorSound(enabled: boolean) {
  if (!enabled) return;
  beep(220, 180, 0.1);
}
