"use client";

import { AnimatePresence, m, useMotionValue, useSpring, useTransform } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { Check, CircleDashed, Eye, EyeOff, Fingerprint, Layers, ListChecks, ShieldCheck, Target, WandSparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { BLUEPRINTS } from "@/lib/engine/taxonomy";
import type { TaskFamily } from "@/lib/contracts";
import { TASK_ICONS } from "../workspace/options";

export function FeatureBento() {
  return (
    <div className="grid gap-4 lg:grid-cols-6">
      <TiltCard className="lg:col-span-4" icon={<Target className="size-4" />} kicker="Context intelligence" title="Finds what's missing, and why it matters">
        <ContextDemo />
      </TiltCard>
      <TiltCard className="lg:col-span-2" icon={<Fingerprint className="size-4" />} kicker="Intent preservation" title="Never drops what you asked for">
        <IntentDemo />
      </TiltCard>
      <TiltCard className="lg:col-span-2" icon={<ShieldCheck className="size-4" />} kicker="Prompt security" title="Catches secrets before you hit send">
        <SecurityDemo />
      </TiltCard>
      <TiltCard className="lg:col-span-4" icon={<Layers className="size-4" />} kicker="Task-aware" title="Different jobs need different structure">
        <TaskDemo />
      </TiltCard>
    </div>
  );
}

/* --------------------------------------------------------------- TiltCard */

function TiltCard({
  className,
  icon,
  kicker,
  title,
  children,
}: {
  className?: string;
  icon: ReactNode;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 150, damping: 18 });
  const sry = useSpring(ry, { stiffness: 150, damping: 18 });
  const glowX = useMotionValue(50);
  const glowY = useMotionValue(0);
  const bg = useTransform(
    [glowX, glowY] as const,
    ([x, y]: number[]) => `radial-gradient(480px circle at ${x}% ${y}%, rgb(157 143 255 / 0.12), transparent 45%)`,
  );

  return (
    <m.section
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        ry.set((x - 0.5) * 6);
        rx.set(-(y - 0.5) * 6);
        glowX.set(x * 100);
        glowY.set(y * 100);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 1200 }}
      className={cn("glass relative flex flex-col overflow-hidden rounded-[1.75rem] p-6 sm:p-7", className)}
    >
      <m.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: bg }} />
      <div className="relative flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgb(157_143_255/0.3),rgb(92_225_230/0.2))] text-iris-200 ring-1 ring-white/10">
          {icon}
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-iris-300/90">{kicker}</span>
      </div>
      <h3 className="relative mt-4 text-xl font-semibold tracking-[-0.02em] text-fg sm:text-2xl">{title}</h3>
      <div className="relative mt-5 flex-1">{children}</div>
    </m.section>
  );
}

/* ------------------------------------------------------- Context demo */

const GAPS = [
  { label: "Expected behaviour", q: "What should happen instead?", a: "Return in < 200 ms", w: 3 },
  { label: "Error output", q: "Can you paste the logs?", a: "Timeout after 30 s on /checkout", w: 3 },
  { label: "Environment", q: "Which stack?", a: "FastAPI + Postgres", w: 2 },
  { label: "Constraints", q: "What must not change?", a: "Keep the response format", w: 2 },
];

function ContextDemo() {
  const [answered, setAnswered] = useState<Set<number>>(new Set([2]));
  const total = GAPS.reduce((s, g) => s + g.w, 0);
  const got = GAPS.reduce((s, g, i) => s + (answered.has(i) ? g.w : 0), 0);
  const pct = Math.round(15 + (got / total) * 80);
  const toggle = (i: number) =>
    setAnswered((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <p className="mb-3 rounded-xl border border-white/[0.06] bg-ink-950/40 px-4 py-3 font-mono text-[0.85rem] text-fg-soft">
          “Our checkout API got slow, fix it.”
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {GAPS.map((g, i) => {
            const on = answered.has(i);
            return (
              <li key={g.label}>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-pressed={on}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-2.5 text-left transition-[background-color,border-color,transform] duration-200 active:scale-[0.98]",
                    on ? "border-ok/30 bg-ok-soft" : "border-white/[0.07] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm text-fg">
                    {on ? <Check className="size-4 text-ok" aria-hidden /> : <CircleDashed className="size-4 text-fg-faint" aria-hidden />}
                    {g.label}
                  </span>
                  <AnimatePresence mode="wait" initial={false}>
                    <m.span
                      key={on ? "a" : "q"}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className={cn("mt-0.5 block pl-6 text-xs", on ? "text-ok/90" : "text-fg-muted")}
                    >
                      {on ? g.a : g.q}
                    </m.span>
                  </AnimatePresence>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-fg-faint">Tap a gap to answer it, and watch the coverage change.</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <BigGauge value={pct} />
        <span className="text-xs text-fg-muted">context coverage</span>
      </div>
    </div>
  );
}

function BigGauge({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-36">
      <svg viewBox="0 0 128 128" className="size-36 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="gauge-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#bcb2ff" />
            <stop offset="0.6" stopColor="#7f6cff" />
            <stop offset="1" stopColor="#5ce1e6" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth="10" />
        <m.circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="url(#gauge-g)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ type: "spring", stiffness: 70, damping: 16 }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <m.span key={value} initial={{ scale: 0.85, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="text-3xl font-semibold tabular-nums text-fg">
          {value}
        </m.span>
      </span>
    </div>
  );
}

/* -------------------------------------------------------- Intent demo */

const CONSTRAINTS = ["Don't change the response format", "Keep it under 200 words", "No new dependencies"];

function IntentDemo() {
  const [mode, setMode] = useState<"basic" | "intruva">("basic");
  return (
    <div>
      <div className="glass-subtle inline-flex rounded-xl p-1 text-xs" role="radiogroup" aria-label="Rewriter">
        {(["basic", "intruva"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={mode === k}
            onClick={() => setMode(k)}
            className={cn("rounded-lg px-3 py-1.5 transition-colors", mode === k ? "bg-white/[0.1] text-fg" : "text-fg-muted hover:text-fg-soft")}
          >
            {k === "basic" ? "Basic rewriter" : "Intruva"}
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {CONSTRAINTS.map((c, i) => {
          const lost = mode === "basic" && i !== 1;
          return (
            <m.li
              key={c}
              animate={lost ? { x: [0, -4, 4, 0], opacity: 0.55 } : { x: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors duration-300",
                lost ? "border-risk/20 bg-risk-soft/60 text-fg-muted line-through decoration-risk/70" : "border-ok/20 bg-ok-soft/60 text-fg-soft",
              )}
            >
              {lost ? <X className="size-4 shrink-0 text-risk" aria-hidden /> : <Check className="size-4 shrink-0 text-ok" aria-hidden />}
              <span>{c}</span>
              <span className="sr-only">{lost ? "(dropped)" : "(kept)"}</span>
            </m.li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-fg-muted">
        {mode === "basic"
          ? "Polished output, but 2 of your 3 constraints silently disappeared."
          : "Every sentence you wrote is carried over word for word, and checked."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------ Security demo */

function SecurityDemo() {
  const [redacted, setRedacted] = useState(false);
  const [reveal, setReveal] = useState(false);
  return (
    <div>
      <div className="rounded-xl border border-white/[0.06] bg-ink-950/50 p-4 font-mono text-[0.8rem] leading-relaxed text-fg-soft">
        Why does auth fail? key{" "}
        <AnimatePresence mode="wait" initial={false}>
          {redacted ? (
            <m.span
              key="r"
              initial={{ opacity: 0, filter: "blur(6px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              className="rounded bg-ok-soft px-1 text-ok"
            >
              [REDACTED_API_KEY]
            </m.span>
          ) : (
            <m.span key="k" exit={{ opacity: 0, filter: "blur(6px)", scale: 0.9 }} className="mark-secret rounded px-0.5 !text-[#ffd0d6]">
              {reveal ? "sk-proj-EXAMPLE7f3a…" : "sk-p••••••••••"}
            </m.span>
          )}
        </AnimatePresence>{" "}
        and DB pass{" "}
        <span className={cn("rounded px-0.5", redacted ? "bg-ok-soft text-ok" : "mark-secret !text-[#ffd0d6]")}>
          {redacted ? "[REDACTED_SECRET]" : "pass=•••••••"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRedacted((r) => !r)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-colors",
            redacted ? "bg-white/[0.06] text-fg-soft hover:bg-white/[0.1]" : "bg-iris-500/25 text-iris-100 hover:bg-iris-500/35",
          )}
        >
          <WandSparkles className="size-3.5" aria-hidden /> {redacted ? "Undo" : "Redact 2 secrets"}
        </button>
        {!redacted && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs text-fg-muted hover:bg-white/[0.05] hover:text-fg"
          >
            {reveal ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
            {reveal ? "Hide" : "Peek"}
          </button>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-fg-muted">
        Runs on your device. Also flags PII, prompt injection, and risky agent permissions.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- Task demo */

const TASKS: TaskFamily[] = ["debugging", "research", "writing", "system_design", "agent_instruction"];

function TaskDemo() {
  const [t, setT] = useState<TaskFamily>("debugging");
  const bp = BLUEPRINTS[t];
  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
      <div className="flex gap-2 overflow-x-auto sm:flex-col" role="radiogroup" aria-label="Task type">
        {TASKS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={t === k}
            onClick={() => setT(k)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
              t === k ? "bg-white/[0.09] text-fg ring-1 ring-white/10" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg-soft",
            )}
          >
            {TASK_ICONS[k]}
            {BLUEPRINTS[k].label}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-white/[0.06] bg-ink-950/40 p-5">
        <AnimatePresence mode="wait">
          <m.div key={t} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
            <p className="text-sm text-fg-soft">{bp.description}</p>
            <p className="mt-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-fg-faint">
              <ListChecks className="size-3.5" aria-hidden /> What it checks for
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {bp.fields.map((f, i) => (
                <m.span
                  key={f.field}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * i }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    f.importance === "high" ? "border-iris-400/30 bg-iris-500/15 text-iris-200" : "border-white/10 bg-white/[0.04] text-fg-soft",
                  )}
                >
                  {f.label}
                </m.span>
              ))}
            </div>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-fg-faint">Output it asks for</p>
            <ol className="mt-2 space-y-1">
              {bp.default_output.map((o, i) => (
                <m.li key={o} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + 0.06 * i }} className="flex gap-2 text-sm text-fg-soft">
                  <span className="tabular-nums text-fg-faint">{i + 1}.</span> {o}
                </m.li>
              ))}
            </ol>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
