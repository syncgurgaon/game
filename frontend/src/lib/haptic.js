// Tiny haptic feedback util — no-ops if not supported (most desktops, iOS Safari)
const supported = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export function haptic(kind = "light") {
  if (!supported) return;
  try {
    const patterns = {
      light: 12,
      medium: 25,
      heavy: 50,
      success: [20, 60, 20],
      error: [60, 40, 60],
      tick: 8,
    };
    navigator.vibrate(patterns[kind] ?? 12);
  } catch (err) {
    console.warn("haptic vibrate failed", err);
  }
}
