/**
 * Device-local preferences only. Per plan §29.4 prompt history / persistent
 * storage is deferred for the pilot: prompts are never written to storage.
 *
 * Motion preference:
 *   "system"  — follow the OS prefers-reduced-motion setting (default)
 *   "full"    — always animate (explicit opt-in, e.g. for demos)
 *   "reduced" — always minimise motion
 */
export type MotionPref = "system" | "full" | "reduced";

const MOTION_KEY = "intruva:motion";

export const motionStore = {
  key: MOTION_KEY,
  get(): MotionPref {
    if (typeof window === "undefined") return "system";
    try {
      const v = JSON.parse(localStorage.getItem(MOTION_KEY) ?? '"system"');
      return v === "full" || v === "reduced" ? v : "system";
    } catch {
      return "system";
    }
  },
  set(v: MotionPref) {
    try {
      localStorage.setItem(MOTION_KEY, JSON.stringify(v));
      window.dispatchEvent(new CustomEvent("intruva:storage", { detail: MOTION_KEY }));
    } catch {
      /* storage unavailable — preference applies for this session only */
    }
  },
};
