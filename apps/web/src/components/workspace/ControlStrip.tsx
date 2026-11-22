"use client";

import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
import type { Importance, OptimizeMode, TargetModel, TaskFamily, TaskSelection } from "@/lib/contracts";
import { cn } from "@/lib/cn";
import { BLUEPRINTS } from "@/lib/engine/taxonomy";
import { Button } from "../ui/Button";
import { Kbd, SegmentedControl } from "../ui/primitives";
import { Select } from "../ui/Select";
import { MODEL_OPTIONS, MODE_COPY, MODE_OPTIONS, TASK_ICONS, TASK_OPTIONS } from "./options";

export function ControlStrip({
  task,
  setTask,
  mode,
  setMode,
  model,
  setModel,
  detected,
  onRun,
  disabled,
}: {
  task: TaskSelection;
  setTask: (t: TaskSelection) => void;
  mode: OptimizeMode;
  setMode: (m: OptimizeMode) => void;
  model: TargetModel;
  setModel: (m: TargetModel) => void;
  detected: { family: TaskFamily; confidence: Importance } | null;
  onRun: () => void;
  disabled?: boolean;
}) {
  const [advanced, setAdvanced] = useState(model !== "generic");

  return (
    <div className="border-t border-white/[0.06] px-4 pb-4 pt-3.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Select
          label="Task type"
          value={task}
          onChange={setTask}
          options={TASK_OPTIONS}
          className="w-full sm:w-60"
          renderValue={(o) =>
            o.value === "auto" ? (
              <>
                {detected ? TASK_ICONS[detected.family] : o.icon}
                <span className="truncate">
                  Auto
                  {detected && (
                    <span className="text-fg-muted">
                      {" "}
                      · looks like {BLUEPRINTS[detected.family].label.toLowerCase()}
                    </span>
                  )}
                </span>
              </>
            ) : (
              <>
                {o.icon}
                <span className="truncate">{o.label}</span>
              </>
            )
          }
        />
        <SegmentedControl label="Optimization mode" value={mode} onChange={setMode} options={MODE_OPTIONS} />
        <button
          type="button"
          onClick={() => setAdvanced((a) => !a)}
          aria-expanded={advanced}
          aria-controls="advanced-options"
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-[0.85rem] px-3 text-[0.8125rem] transition-colors",
            advanced ? "bg-white/[0.06] text-fg" : "text-fg-muted hover:text-fg",
          )}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden /> Advanced
        </button>
        <Button
          variant="primary"
          size="md"
          onClick={onRun}
          disabled={disabled}
          className="ml-auto w-full sm:w-auto"
          iconRight={<ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />}
        >
          {mode === "deep" ? "Analyze" : "Optimize"}
          <span className="ml-1 hidden items-center gap-0.5 opacity-60 lg:inline-flex">
            <Kbd className="border-ink-950/20 bg-ink-950/10 text-ink-950">⌘↵</Kbd>
          </span>
        </Button>
      </div>

      <AnimatePresence mode="wait">
        <m.p
          key={mode}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="mt-2.5 text-xs text-fg-muted"
        >
          {MODE_COPY[mode]}
        </m.p>
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {advanced && (
          <m.div
            id="advanced-options"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 sm:grid-cols-[auto_1fr] sm:items-center">
              <span className="text-xs text-fg-muted">Target AI</span>
              <div className="flex flex-wrap items-center gap-3">
                <Select label="Target AI" value={model} onChange={setModel} options={MODEL_OPTIONS} className="w-48" />
                <span className="text-xs text-fg-faint">Only changes the section format. Optional.</span>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
