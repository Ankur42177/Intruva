"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { CloudCog, FlaskConical } from "lucide-react";
import { intruva } from "@/lib/api/client";
import { cn } from "@/lib/cn";

/**
 * Truthful engine + data-flow indicator (plan §B4, §16, §29.4 "demo mode
 * clearly labelled"). Reads the client's real engine — it can never claim
 * on-device processing while text is sent to a server.
 */
export function EngineIndicator({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const demo = intruva.engine === "demo";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors",
          demo
            ? "border-warn/25 bg-warn-soft text-warn hover:bg-warn/15"
            : "border-info/25 bg-info-soft text-info hover:bg-info/15",
        )}
      >
        {demo ? <FlaskConical className="size-3.5" aria-hidden /> : <CloudCog className="size-3.5" aria-hidden />}
        <span className="hidden min-[400px]:inline">{demo ? "Demo mode · on-device" : "Live engine"}</span>
        <span className="min-[400px]:hidden">{demo ? "Demo" : "Live"}</span>
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            id={id}
            role="dialog"
            aria-label="About the analysis engine"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="glass-strong absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] origin-top-right rounded-2xl p-4 text-sm"
          >
            <p className="font-medium text-fg">
              {demo ? "Demo mode: rule-based engine, no AI model connected" : "Connected to the Intruva API"}
            </p>
            <p className="mt-1.5 leading-relaxed text-fg-muted">
              {demo
                ? "Diagnosis and optimization use deterministic task blueprints and pattern checks running in your browser. Results are useful but simpler than the AI-assisted engine. Nothing you type leaves this device or is stored."
                : "Analysis runs on the Intruva API. The security scan still runs on your device first so you can redact secrets before sending. Raw prompts are not logged."}
            </p>
            <ul className="mt-3 space-y-1.5 text-xs text-fg-soft">
              <li className="flex gap-2"><span className="text-ok" aria-hidden>●</span> Security scan: on your device</li>
              <li className="flex gap-2">
                <span className={demo ? "text-ok" : "text-info"} aria-hidden>●</span> Analysis: {demo ? "on your device" : "Intruva API"}
              </li>
              <li className="flex gap-2"><span className="text-ok" aria-hidden>●</span> Prompts stored: never</li>
            </ul>
            <Link href="/privacy" className="mt-3 inline-block text-xs font-medium text-aqua-300 hover:underline">
              How Intruva handles data →
            </Link>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
