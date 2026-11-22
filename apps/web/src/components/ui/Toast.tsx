"use client";

import { AnimatePresence, m } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "info" | "warn";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  toast: (message: string, opts?: { tone?: ToastTone; action?: ToastItem["action"]; duration?: number }) => void;
  /** Screen-reader-only status announcement (plan §15.8). */
  announce: (message: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [live, setLive] = useState("");
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const announce = useCallback((m: string) => {
    setLive("");
    requestAnimationFrame(() => setLive(m));
  }, []);

  const toast = useCallback<ToastApi["toast"]>(
    (message, opts) => {
      idRef.current += 1;
      const id = idRef.current;
      setItems((xs) => [...xs.slice(-2), { id, message, tone: opts?.tone ?? "success", action: opts?.action }]);
      announce(message);
      setTimeout(() => dismiss(id), opts?.duration ?? (opts?.action ? 6000 : 3200));
    },
    [announce, dismiss],
  );

  const api = useMemo(() => ({ toast, announce }), [toast, announce]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {live}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <m.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="glass-strong pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl py-2.5 pl-3.5 pr-2 text-sm text-fg"
            >
              {t.tone === "success" ? (
                <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden />
              ) : t.tone === "warn" ? (
                <TriangleAlert className="size-4 shrink-0 text-warn" aria-hidden />
              ) : (
                <Info className="size-4 shrink-0 text-info" aria-hidden />
              )}
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="rounded-lg px-2.5 py-1 text-[0.8125rem] font-medium text-aqua-300 hover:bg-white/[0.06]"
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(t.id)}
                className={cn("rounded-lg p-1.5 text-fg-muted hover:bg-white/[0.06] hover:text-fg")}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
