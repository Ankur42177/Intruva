/**
 * Device-local preferences only. Per plan §29.4 prompt history / persistent
 * storage is deferred for the pilot: prompts are never written to storage.
 */
export type MotionPref = "system" | "reduced";

const MOTION_KEY = "intruva:motion";

export const motionStore = {
  key: MOTION_KEY,
  get(): MotionPref {
    if (typeof window === "undefined") return "system";
    try {
      return localStorage.getItem(MOTION_KEY) === '"reduced"' ? "reduced" : "system";
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
