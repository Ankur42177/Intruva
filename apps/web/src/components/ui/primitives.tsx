"use client";

import { m } from "motion/react";
import {
  useCallback,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Importance, Severity } from "@/lib/contracts";

/* ------------------------------------------------------------- GlassCard */

export function GlassCard({
  className,
  strong,
  sheen = true,
  aurora,
  children,
  as: Tag = "div",
  ...rest
}: HTMLAttributes<HTMLElement> & {
  strong?: boolean;
  sheen?: boolean;
  aurora?: boolean;
  as?: "div" | "section" | "article" | "aside";
}) {
  const ref = useRef<HTMLElement>(null);
  const onMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, []);
  return (
    <Tag
      ref={ref as never}
      onPointerMove={sheen ? onMove : undefined}
      className={cn(strong ? "glass-strong" : "glass", sheen && "sheen", aurora && "ring-aurora", "rounded-2xl", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ Pill */

type Tone = "neutral" | "iris" | "aqua" | "ok" | "warn" | "risk" | "crit" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "bg-white/[0.05] text-fg-soft border-white/10",
  iris: "bg-iris-500/15 text-iris-200 border-iris-400/25",
  aqua: "bg-aqua-400/12 text-aqua-300 border-aqua-400/25",
  ok: "bg-ok-soft text-ok border-ok/25",
  warn: "bg-warn-soft text-warn border-warn/25",
  risk: "bg-risk-soft text-risk border-risk/25",
  crit: "bg-crit/15 text-[#ffb3bf] border-crit/35",
  info: "bg-info-soft text-info border-info/25",
};

export function Pill({
  tone = "neutral",
  className,
  children,
  icon,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; icon?: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5",
        toneClass[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

export const severityTone: Record<Severity | "none", Tone> = {
  none: "ok",
  info: "info",
  low: "neutral",
  medium: "warn",
  high: "risk",
  critical: "crit",
};

export const severityLabel: Record<Severity | "none", string> = {
  none: "No issues found",
  info: "Info",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const importanceTone: Record<Importance, Tone> = { high: "iris", medium: "aqua", low: "neutral" };

/* -------------------------------------------------------------------- Kbd */

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/15 bg-white/[0.06] px-1.5 font-mono text-[0.7rem] text-fg-soft shadow-[inset_0_-1px_0_rgb(255_255_255/0.08)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------- SegmentedControl */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon?: ReactNode;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("glass-subtle relative inline-flex rounded-[0.9rem] p-1", className)}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={o.hint}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative z-10 inline-flex items-center gap-1.5 rounded-[0.65rem] font-medium transition-colors duration-200",
              size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-[0.8125rem]",
              active ? "text-fg" : "text-fg-muted hover:text-fg-soft",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 -z-10 rounded-[0.65rem] transition-[opacity,transform] duration-200 ease-[var(--ease-out-expo)]",
                "bg-white/[0.09] shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_4px_14px_-6px_rgb(0_0_0/0.6)]",
                active ? "scale-100 opacity-100" : "scale-90 opacity-0",
              )}
            />
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- Disclosure */

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
  summaryClassName,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  summaryClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn("flex w-full items-center justify-between gap-3 text-left", summaryClassName)}
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-fg-muted transition-transform duration-300", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <m.div
        id={id}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden"
        aria-hidden={!open}
        inert={!open}
      >
        {children}
      </m.div>
    </div>
  );
}

/* ---------------------------------------------------------------- ScoreBar */

export function scoreWord(v: number) {
  if (v >= 0.8) return "Strong";
  if (v >= 0.55) return "Fair";
  if (v >= 0.3) return "Weak";
  return "Missing";
}

export function ScoreBar({
  value,
  before,
  label,
  hint,
  className,
}: {
  value: number;
  before?: number;
  label: string;
  hint?: string;
  className?: string;
}) {
  const pct = Math.round(value * 100);
  const tone = value >= 0.8 ? "bg-ok" : value >= 0.55 ? "bg-aqua-400" : value >= 0.3 ? "bg-warn" : "bg-risk";
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[0.8125rem]">
        <span className="text-fg-soft" title={hint}>
          {label}
        </span>
        <span className="tabular-nums text-fg-muted">
          <span className="text-fg">{scoreWord(value)}</span>
          <span className="sr-only">, </span>
          <span className="ml-1.5 text-xs">{pct}</span>
        </span>
      </div>
      <div
        className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${scoreWord(value)}, ${pct} of 100${before !== undefined ? `, was ${Math.round(before * 100)}` : ""}`}
      >
        {before !== undefined && before < value && (
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-white/20"
            style={{ width: `${Math.round(before * 100)}%` }}
          />
        )}
        <m.span
          className={cn("absolute inset-y-0 left-0 rounded-full", tone)}
          initial={{ width: before !== undefined ? `${Math.round(before * 100)}%` : 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          style={{ opacity: 0.9 } as CSSProperties}
        />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Eyebrow */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-medium uppercase tracking-[0.18em] text-iris-300/90", className)}>{children}</p>
  );
}
