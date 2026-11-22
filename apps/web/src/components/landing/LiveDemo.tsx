"use client";

import { AnimatePresence, m, useInView } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CircleCheck, CircleDot, Pause, Play, RotateCcw, ShieldAlert, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { optimizeLocal } from "@/lib/engine/optimize";
import { BLUEPRINTS } from "@/lib/engine/taxonomy";
import { SAMPLES } from "@/lib/samples";
import { Highlighted } from "../workspace/highlight";
import { PromptText } from "../workspace/PromptText";
import { useMotionPref } from "../layout/MotionPrefs";

const DEMO_IDS = ["code", "research", "write", "agent", "secret"];
const STAGES = ["Before", "Diagnosis", "After"] as const;
const STAGE_MS = [3600, 5200, 6500];

export function LiveDemo() {
  const demos = useMemo(() => SAMPLES.filter((s) => DEMO_IDS.includes(s.id)), []);
  const [idx, setIdx] = useState(0);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const { animate } = useMotionPref();

  const sample = demos[idx];
  const result = useMemo(
    () =>
      optimizeLocal({ prompt: sample.prompt, task_type: "auto", mode: "quick", target_model: "generic", answers: [] }),
    [sample],
  );
  const a = result.analysis;

  // autoplay through stages, then move to the next example
  useEffect(() => {
    if (!playing || !inView || !animate) return;
    const t = setTimeout(() => {
      if (stage < 2) setStage(stage + 1);
      else {
        setStage(0);
        setIdx((i) => (i + 1) % demos.length);
      }
    }, STAGE_MS[stage]);
    return () => clearTimeout(t);
  }, [stage, playing, inView, animate, demos.length]);

  const pick = (i: number) => {
    setIdx(i);
    setStage(0);
  };

  const before = Math.round(result.scores_before.overall * 100);
  const after = Math.round(result.scores_after.overall * 100);

  return (
    <div ref={ref} className="glass-strong ring-aurora relative overflow-hidden rounded-[2rem]">
      <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-[radial-gradient(circle,rgb(127_108_255/0.18),transparent_65%)] blur-2xl" />

      {/* example tabs */}
      <div className="relative flex gap-1 overflow-x-auto border-b border-white/[0.06] px-3 pt-3" role="tablist" aria-label="Demo examples">
        {demos.map((d, i) => (
          <button
            key={d.id}
            role="tab"
            type="button"
            aria-selected={i === idx}
            onClick={() => pick(i)}
            className={cn(
              "relative shrink-0 rounded-t-xl px-4 pb-3 pt-2 text-[0.8125rem] transition-colors",
              i === idx ? "text-fg" : "text-fg-muted hover:text-fg-soft",
            )}
          >
            {BLUEPRINTS[d.family].label}
            {d.id === "secret" && <span className="ml-1.5 text-risk">●</span>}
            {i === idx && (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[linear-gradient(90deg,var(--color-iris-400),var(--color-aqua-400))]" />
            )}
          </button>
        ))}
      </div>

      {/* stage stepper */}
      <div className="relative flex flex-wrap items-center gap-3 px-5 pt-5 sm:px-7">
        <ol className="flex flex-1 items-center gap-2" aria-label="Demo stage">
          {STAGES.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStage(i);
                  setPlaying(false);
                }}
                aria-current={i === stage ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  i === stage ? "bg-white/[0.09] text-fg" : i < stage ? "text-aqua-300" : "text-fg-faint hover:text-fg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[0.65rem]",
                    i <= stage ? "bg-[linear-gradient(135deg,var(--color-iris-400),var(--color-aqua-400))] text-ink-950" : "bg-white/10",
                  )}
                >
                  {i + 1}
                </span>
                {s}
              </button>
              {i < 2 && (
                <span className="relative h-px flex-1 overflow-hidden bg-white/10">
                  {i === stage && playing && inView && animate ? (
                    <m.span
                      key={`${idx}-${stage}`}
                      className="absolute inset-y-0 left-0 bg-iris-400"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: STAGE_MS[stage] / 1000, ease: "linear" }}
                    />
                  ) : (
                    <span className={cn("absolute inset-0", i < stage ? "bg-aqua-400/60" : "")} />
                  )}
                </span>
              )}
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex size-9 items-center justify-center rounded-full text-fg-muted hover:bg-white/[0.06] hover:text-fg"
            aria-label={playing ? "Pause demo" : "Play demo"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setStage(0);
              setPlaying(true);
            }}
            className="inline-flex size-9 items-center justify-center rounded-full text-fg-muted hover:bg-white/[0.06] hover:text-fg"
            aria-label="Replay"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
      </div>

      <div className="relative grid gap-5 p-5 sm:p-7 lg:grid-cols-[0.9fr_1.1fr]">
        {/* left: the original prompt, scanned */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-fg-faint">What you typed</p>
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-950/50 p-5">
            <p className="editor-layer min-h-24 text-[0.9rem] text-fg">
              <Typewriter key={sample.id} text={sample.prompt} findings={stage >= 1 ? a.security.findings : []} />
            </p>
            {stage === 1 && (
              <m.div
                key={`scan-${idx}`}
                aria-hidden
                className="pointer-events-none absolute inset-x-0 h-16 bg-[linear-gradient(180deg,transparent,rgb(92_225_230/0.16),transparent)]"
                initial={{ top: "-20%" }}
                animate={{ top: "110%" }}
                transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1], repeat: 1 }}
              />
            )}
          </div>

          <div className="mt-5 flex items-center gap-5">
            <CoverageRing value={stage === 2 ? after : stage === 1 ? before : 0} />
            <div className="text-sm">
              <p className="text-fg">
                {stage === 0 ? "Waiting to analyse…" : stage === 1 ? "Context coverage today" : "Coverage after Intruva"}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
                {stage === 2
                  ? "Missing context is labelled as assumptions, never invented. Answer the questions to raise it further."
                  : "A heuristic: how much of what this task needs is actually in the prompt."}
              </p>
            </div>
          </div>
        </div>

        {/* right: stage panel */}
        <div className="min-h-[22rem]">
          <AnimatePresence mode="wait">
            {stage === 0 && (
              <m.div
                key={`b-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex h-full flex-col justify-center rounded-2xl border border-dashed border-white/10 p-6 text-center"
              >
                <p className="font-display text-2xl italic text-fg-soft">“{sample.pitch}”</p>
                <p className="mt-3 text-sm text-fg-muted">
                  Most AI tools would just reword this. Intruva diagnoses it first.
                </p>
              </m.div>
            )}

            {stage === 1 && (
              <m.div
                key={`d-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <Stagger i={0}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-iris-400/25 bg-iris-500/15 px-2.5 py-0.5 text-xs text-iris-200">
                      Task: {BLUEPRINTS[a.task_type].label}
                    </span>
                    <span className="text-xs text-fg-muted">{a.task_reason}</span>
                  </div>
                </Stagger>
                <div>
                  <Stagger i={1}>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-fg-faint">Missing, ranked by impact</p>
                  </Stagger>
                  <ul className="space-y-2">
                    {a.missing_context.slice(0, 4).map((mc, i) => (
                      <Stagger key={mc.field} i={i + 2} as="li">
                        <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-2.5">
                          <CircleDot className={cn("mt-0.5 size-4 shrink-0", mc.importance === "high" ? "text-iris-300" : "text-aqua-300")} aria-hidden />
                          <span className="min-w-0">
                            <span className="block text-sm text-fg">{mc.label}</span>
                            <span className="block text-xs text-fg-muted">{mc.question}</span>
                          </span>
                          <span className="ml-auto shrink-0 text-[0.7rem] uppercase tracking-wide text-fg-faint">{mc.importance}</span>
                        </div>
                      </Stagger>
                    ))}
                  </ul>
                </div>
                {a.security.findings.length > 0 && (
                  <Stagger i={7}>
                    <div className="flex items-start gap-3 rounded-xl border border-risk/25 bg-risk-soft px-3.5 py-2.5">
                      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-risk" aria-hidden />
                      <p className="text-sm text-fg-soft">
                        {a.security.findings.length} security finding{a.security.findings.length > 1 ? "s" : ""}:{" "}
                        {a.security.findings
                          .slice(0, 3)
                          .map((f) => f.title.toLowerCase())
                          .join(", ")}
                      </p>
                    </div>
                  </Stagger>
                )}
              </m.div>
            )}

            {stage === 2 && (
              <m.div
                key={`a-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className="mb-3 flex flex-wrap gap-2">
                  {result.preservation.slice(0, 4).map((p, i) => (
                    <Stagger key={p.id} i={i}>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-ok/20 bg-ok-soft px-2.5 py-1 text-xs text-ok">
                        <CircleCheck className="size-3.5" aria-hidden /> {p.label}
                      </span>
                    </Stagger>
                  ))}
                </div>
                <div className="relative max-h-[20rem] overflow-hidden rounded-2xl border border-aqua-400/15 bg-ink-950/50 p-5">
                  <m.div initial={{ clipPath: "inset(0 0 100% 0)" }} animate={{ clipPath: "inset(0 0 0% 0)" }} transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}>
                    <PromptText text={result.optimized} className="text-[0.8rem]" />
                  </m.div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,transparent,var(--color-ink-950))]" />
                </div>
                <Link
                  href={`/workspace/?sample=${sample.id}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-aqua-300 hover:text-aqua-400"
                >
                  <Sparkles className="size-4" aria-hidden /> Open this in the workspace <ArrowRight className="size-4" aria-hidden />
                </Link>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Stagger({ children, i, as = "div" }: { children: React.ReactNode; i: number; as?: "div" | "li" }) {
  const C = as === "li" ? m.li : m.div;
  return (
    <C initial={{ opacity: 0, y: 8, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.45, delay: 0.12 * i, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </C>
  );
}

function Typewriter({ text, findings }: { text: string; findings: import("@/lib/contracts").SecurityFinding[] }) {
  const [n, setN] = useState(0);
  const { animate } = useMotionPref();
  useEffect(() => {
    if (!animate) return;
    const t = setInterval(() => setN((c) => (c >= text.length ? c : c + 2)), 22);
    return () => clearInterval(t);
  }, [text, animate]);
  const shown = animate ? n : text.length;
  if (shown >= text.length) return <Highlighted text={text} findings={findings} visible />;
  return (
    <>
      {text.slice(0, shown)}
      <span className="ml-px inline-block h-4 w-px animate-caret bg-aqua-400 align-middle" />
    </>
  );
}

function CoverageRing({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9d8fff" />
            <stop offset="1" stopColor="#5ce1e6" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="5" />
        <m.circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="url(#ring-g)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-fg" aria-label={`Coverage ${value} of 100`}>
        {value}
      </span>
    </div>
  );
}
