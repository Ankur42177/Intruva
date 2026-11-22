"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useStored } from "@/lib/useStored";
import { motionStore, type MotionPref } from "@/lib/storage";

interface MotionCtx {
  pref: MotionPref;
  setPref: (p: MotionPref) => void;
  /** What's actually in effect after combining the preference with the OS setting. */
  animate: boolean;
  osReduced: boolean;
}

const Ctx = createContext<MotionCtx>({ pref: "system", setPref: () => {}, animate: true, osReduced: false });

export const useMotionPref = () => useContext(Ctx);

const loadFeatures = () => import("./motionFeatures").then((mod) => mod.default);

/** Applies the saved preference before first paint (no flash of the wrong motion mode). */
export const motionBootScript = `try{var v=JSON.parse(localStorage.getItem(${JSON.stringify(
  motionStore.key,
)}));if(v==="reduced"||v==="full")document.documentElement.dataset.motion=v}catch(e){}`;

const mq = "(prefers-reduced-motion: reduce)";
function subscribeOs(cb: () => void) {
  const m = window.matchMedia(mq);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

export function MotionPrefsProvider({ children }: { children: ReactNode }) {
  const pref = useStored(motionStore.get, "system" as MotionPref);
  const osReduced = useSyncExternalStore(
    subscribeOs,
    () => window.matchMedia(mq).matches,
    () => false,
  );
  const animate = pref === "full" || (pref === "system" && !osReduced);

  useEffect(() => {
    if (pref === "system") delete document.documentElement.dataset.motion;
    else document.documentElement.dataset.motion = pref;
  }, [pref]);

  const setPref = useCallback((p: MotionPref) => motionStore.set(p), []);

  return (
    <Ctx.Provider value={{ pref, setPref, animate, osReduced }}>
      {/* LazyMotion keeps the initial bundle small: animation features load after first paint. */}
      <LazyMotion features={loadFeatures} strict>
        <MotionConfig reducedMotion={pref === "full" ? "never" : pref === "reduced" ? "always" : "user"}>
          {children}
        </MotionConfig>
      </LazyMotion>
    </Ctx.Provider>
  );
}
