"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("intruva:storage", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("intruva:storage", cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * Hydration-safe read of a localStorage-backed value. The server (and the
 * first client render) use `serverValue`; afterwards the stored value wins.
 * Snapshots are cached by JSON so array/object reads stay referentially stable.
 */
export function useStored<T>(read: () => T, serverValue: T): T {
  const cache = useRef<{ json: string; value: T } | null>(null);
  const getSnapshot = useCallback(() => {
    const value = read();
    const json = JSON.stringify(value);
    if (cache.current?.json === json) return cache.current.value;
    cache.current = { json, value };
    return value;
  }, [read]);
  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}
