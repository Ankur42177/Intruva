"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Eraser, ShieldAlert, ShieldCheck, WandSparkles } from "lucide-react";
import type { SecurityReport } from "@/lib/contracts";
import { cn } from "@/lib/cn";
import { MAX_PROMPT_CHARS } from "@/lib/engine/analyze";
import { applyRedactions } from "@/lib/security/scan";
import { Kbd } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { Highlighted, categoryLabel } from "./highlight";

const PLACEHOLDERS = [
  "Our checkout API got slow after yesterday's deploy — fix it…",
  "Write a mail to my manager asking to move my review…",
  "Explain operating systems for a job interview…",
  "Design a URL shortener for 100M users…",
  "Research this company and tell me if it's worth joining…",
];

export function PromptEditor({
  value,
  onChange,
  onSubmit,
  report,
  error,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  report: SecurityReport;
  error?: string | null;
  autoFocus?: boolean;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [ph, setPh] = useState(0);
  const [focused, setFocused] = useState(false);
  const { toast } = useToast();

  // Auto-grow: the mirror layer and textarea share one height.
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    if (value) return;
    const t = setInterval(() => setPh((p) => (p + 1) % PLACEHOLDERS.length), 3600);
    return () => clearInterval(t);
  }, [value]);

  useEffect(() => {
    if (autoFocus) ta.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  };

  const clear = () => {
    const prev = value;
    onChange("");
    ta.current?.focus();
    toast("Prompt cleared", { tone: "info", action: { label: "Undo", onClick: () => onChange(prev) } });
  };

  const redactable = report.findings.filter((f) => f.redaction);
  const redactAll = () => {
    const prev = value;
    onChange(applyRedactions(value, redactable));
    toast(`Redacted ${redactable.length} item${redactable.length > 1 ? "s" : ""}`, {
      action: { label: "Undo", onClick: () => onChange(prev) },
    });
  };

  const selectSpan = (start: number, end: number) => {
    const el = ta.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
  };

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const over = value.length > MAX_PROMPT_CHARS;
  const counts = report.findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.category] = (acc[f.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div
        className={cn(
          "relative rounded-[1.35rem] transition-[box-shadow,background-color] duration-300",
          focused ? "bg-white/[0.025] shadow-[0_0_0_1px_rgb(157_143_255/0.35),0_0_0_6px_rgb(157_143_255/0.08)]" : "bg-transparent",
        )}
      >
        {/* Mirror layer: draws highlight marks exactly under the textarea text. */}
        <div aria-hidden className="editor-layer pointer-events-none absolute inset-0 overflow-hidden px-5 py-4 text-transparent sm:px-6 sm:py-5">
          <Highlighted text={value} findings={report.findings} />
        </div>
        <label htmlFor="prompt-input" className="sr-only">
          Your prompt
        </label>
        <textarea
          id="prompt-input"
          ref={ta}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          spellCheck={false}
          aria-describedby="prompt-meta prompt-preflight"
          aria-invalid={!!error || over}
          className="editor-layer relative block w-full resize-none overflow-hidden bg-transparent px-5 py-4 text-fg caret-aqua-400 outline-none placeholder:text-transparent sm:px-6 sm:py-5"
          placeholder={PLACEHOLDERS[ph]}
        />
        {!value && (
          <div aria-hidden className="editor-layer pointer-events-none absolute inset-x-0 top-0 px-5 py-4 text-fg-faint sm:px-6 sm:py-5">
            <AnimatePresence mode="wait">
              <m.span
                key={ph}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                className="block"
              >
                {PLACEHOLDERS[ph]}
              </m.span>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Meta row */}
      <div id="prompt-meta" className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-fg-muted">
        <span className={cn("tabular-nums", over && "text-risk")}>
          {value.length.toLocaleString("en-US")} / {MAX_PROMPT_CHARS.toLocaleString("en-US")} chars · {words} words
        </span>
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
          to run
        </span>
        {value && (
          <button
            type="button"
            onClick={clear}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-fg-muted transition-colors hover:bg-white/[0.05] hover:text-fg"
          >
            <Eraser className="size-3.5" aria-hidden /> Clear
          </button>
        )}
      </div>

      {error && (
        <m.p
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 px-1 text-sm text-warn"
        >
          {error}
        </m.p>
      )}

      {/* Live local preflight */}
      <div id="prompt-preflight" aria-live="polite" className="mt-3">
        <AnimatePresence initial={false} mode="wait">
          {report.findings.length > 0 ? (
            <m.div
              key="findings"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-warn/20 bg-warn-soft/60 px-3 py-2.5">
                <ShieldAlert className="size-4 shrink-0 text-warn" aria-hidden />
                <span className="text-[0.8125rem] text-fg-soft">
                  Local preflight found{" "}
                  {Object.entries(counts)
                    .map(([k, n]) => `${n} ${categoryLabel[k as keyof typeof categoryLabel].toLowerCase()}`)
                    .join(", ")}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {report.findings.slice(0, 4).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => selectSpan(f.span.start, f.span.end)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.7rem] text-fg-soft hover:bg-white/[0.08]"
                      title="Select this text in the editor"
                    >
                      {f.title}
                    </button>
                  ))}
                </span>
                {redactable.length > 0 && (
                  <button
                    type="button"
                    onClick={redactAll}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-fg hover:bg-white/[0.1]"
                  >
                    <WandSparkles className="size-3.5" aria-hidden /> Redact {redactable.length}
                  </button>
                )}
              </div>
            </m.div>
          ) : value.trim().length > 12 ? (
            <m.p
              key="clean"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 px-1 text-xs text-fg-muted"
            >
              <ShieldCheck className="size-3.5 text-ok" aria-hidden /> Local preflight: no secrets or risky instructions detected
            </m.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
