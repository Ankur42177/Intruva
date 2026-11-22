"use client";

import { m } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import type { PipelineStage } from "@/lib/contracts";
import { cn } from "@/lib/cn";
import { Button } from "../ui/Button";
import { GlassCard } from "../ui/primitives";

const STAGES: Record<PipelineStage, { label: string; detail: string }> = {
  scan: { label: "Security preflight", detail: "Checking for secrets, personal data, and risky instructions" },
  classify: { label: "Understanding the task", detail: "Matching your request to a task blueprint" },
  diagnose: { label: "Diagnosing context", detail: "Finding what's known, what's missing, and what's assumed" },
  optimize: { label: "Building the prompt", detail: "Adding structure while keeping your words" },
  verify: { label: "Verifying intent", detail: "Checking nothing you asked for was lost" },
};

export function PipelineProgress({
  stages,
  current,
  onCancel,
}: {
  stages: PipelineStage[];
  current: PipelineStage | null;
  onCancel: () => void;
}) {
  const idx = current ? stages.indexOf(current) : -1;
  return (
    <div className="space-y-5">
      <GlassCard strong aurora className="overflow-hidden p-6 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[radial-gradient(circle,rgb(127_108_255/0.25),transparent_65%)] blur-2xl" />
        <p className="shimmer-text text-lg font-medium" aria-hidden>
          {current ? STAGES[current].label : "Starting"}…
        </p>
        <ol className="mt-5 space-y-3.5" aria-label="Analysis progress">
          {stages.map((s, i) => {
            const state = i < idx ? "done" : i === idx ? "active" : "todo";
            return (
              <m.li
                key={s}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3"
                aria-current={state === "active" ? "step" : undefined}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                    state === "done" && "border-ok/40 bg-ok-soft text-ok",
                    state === "active" && "border-aqua-400/50 bg-aqua-400/10 text-aqua-300",
                    state === "todo" && "border-white/10 text-fg-faint",
                  )}
                >
                  {state === "done" ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : state === "active" ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <span className="text-[0.65rem]">{i + 1}</span>
                  )}
                </span>
                <span>
                  <span className={cn("block text-sm", state === "todo" ? "text-fg-muted" : "text-fg")}>
                    {STAGES[s].label}
                    <span className="sr-only">: {state === "done" ? "complete" : state === "active" ? "in progress" : "pending"}</span>
                  </span>
                  <span className="block text-xs text-fg-muted">{STAGES[s].detail}</span>
                </span>
              </m.li>
            );
          })}
        </ol>
        <div className="mt-6 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </GlassCard>
      <div className="grid gap-4 sm:grid-cols-2" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass-subtle rounded-2xl p-5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-4 h-3 w-full" />
            <div className="skeleton mt-2 h-3 w-4/5" />
            <div className="skeleton mt-2 h-3 w-3/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
