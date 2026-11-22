"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { useStored } from "@/lib/useStored";
import { motionStore, type MotionPref } from "@/lib/storage";

const Ctx = createContext<{ pref: MotionPref; setPref: (p: MotionPref) => void }>({
  pref: "system",
  setPref: () => {},
});

const loadFeatures = () => import("./motionFeatures").then((mod) => mod.default);

export const useMotionPref = () => useContext(Ctx);

/**
 * Inline script for <head>: applies the saved low-motion preference before
 * first paint so there's no flash of animation (see Next docs: preventing flash).
 */
export const motionBootScript = `try{if(JSON.parse(localStorage.getItem(${JSON.stringify(
  motionStore.key,
)}))==="reduced")document.documentElement.dataset.motion="reduced"}catch(e){}`;

export function MotionPrefsProvider({ children }: { children: ReactNode }) {
  const pref = useStored(motionStore.get, "system" as MotionPref);

  useEffect(() => {
    if (pref === "reduced") document.documentElement.dataset.motion = "reduced";
    else delete document.documentElement.dataset.motion;
  }, [pref]);

  const setPref = useCallback((p: MotionPref) => motionStore.set(p), []);

  return (
    <Ctx.Provider value={{ pref, setPref }}>
      {/* LazyMotion keeps the initial bundle small: animation features load after first paint. */}
      <LazyMotion features={loadFeatures} strict>
        <MotionConfig reducedMotion={pref === "reduced" ? "always" : "user"}>{children}</MotionConfig>
      </LazyMotion>
    </Ctx.Provider>
  );
}
