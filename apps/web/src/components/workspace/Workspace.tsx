"use client";

import { AnimatePresence, m } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CloudOff, FileWarning, FlaskConical, PencilLine, RotateCcw } from "lucide-react";
import type {
  AnalysisResult,
  ClarificationAnswer,
  OptimizeMode,
  OptimizeResult,
  PipelineStage,
  SecurityFinding,
  TargetModel,
  TaskSelection,
} from "@/lib/contracts";
import { BackendUnavailableError, configuredEngine, intruva, type Engine } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { ValidationError, classify } from "@/lib/engine/analyze";
import { BLUEPRINTS } from "@/lib/engine/taxonomy";
import { SAMPLES, sampleById } from "@/lib/samples";
import { applyRedactions } from "@/lib/security/scan";
import { HANDOFF_KEY } from "@/lib/handoff";
import { Button } from "../ui/Button";
import { Disclosure, GlassCard, Pill } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { ClarifyFlow } from "./ClarifyFlow";
import { ControlStrip } from "./ControlStrip";
import { DiagnosisView } from "./DiagnosisView";
import { Highlighted } from "./highlight";
import { MODE_OPTIONS, TASK_ICONS } from "./options";
import { PipelineProgress } from "./PipelineProgress";
import { PromptEditor } from "./PromptEditor";
import { ResultView } from "./ResultView";

type Phase = "compose" | "running" | "diagnosis" | "clarify" | "result" | "error";


export function Workspace() {
  const params = useSearchParams();
  const { toast, announce } = useToast();

  const [task, setTask] = useState<TaskSelection>("auto");
  const [mode, setMode] = useState<OptimizeMode>("quick");
  const [model, setModel] = useState<TargetModel>("generic");
  const [engine, setEngine] = useState<Engine>(configuredEngine);

  const [phase, setPhase] = useState<Phase>("compose");
  const [stage, setStage] = useState<PipelineStage | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [answers, setAnswers] = useState<ClarificationAnswer[]>([]);
  const [clarifyStart, setClarifyStart] = useState(0);
  const [validation, setValidation] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ message: string; backend: boolean; retry: () => void } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  /* ------------------------------------------------ initial prompt handoff */
  // useSearchParams makes this route client-rendered, so reading sessionStorage
  // in the initialiser is hydration-safe. The handoff key is removed in an effect
  // (not here) so Strict Mode's double-invoked initialiser still sees it.
  const sampleParam = params.get("sample");
  const [prompt, setPrompt] = useState(() => {
    const sample = sampleById(sampleParam);
    if (sample) return sample.prompt;
    try {
      return sessionStorage.getItem(HANDOFF_KEY) ?? "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    try {
      sessionStorage.removeItem(HANDOFF_KEY);
    } catch {
      /* sessionStorage unavailable */
    }
  }, []);
  // A different ?sample= while mounted: adjust state during render (no effect).
  const [seenSample, setSeenSample] = useState(sampleParam);
  if (sampleParam !== seenSample) {
    setSeenSample(sampleParam);
    const sample = sampleById(sampleParam);
    if (sample) setPrompt(sample.prompt);
  }

  /* --------------------------------------------- live, local-only signals */
  const deferred = useDeferredValue(prompt);
  const liveReport = useMemo(() => intruva.scanLocal(deferred), [deferred]);
  const detected = useMemo(() => {
    if (deferred.trim().length < 12) return null;
    const c = classify(deferred);
    return { family: c.family, confidence: c.confidence };
  }, [deferred]);

  /* -------------------------------------------------------------- helpers */
  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const begin = (list: PipelineStage[]) => {
    abortRef.current?.abort(); // cancel stale work
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStages(list);
    setStage(list[0]);
    setFailure(null);
    setValidation(null);
    setPhase("running");
    return ctrl;
  };

  const handleError = (e: unknown, retry: () => void, back: Phase) => {
    if (e instanceof DOMException && e.name === "AbortError") return;
    if (e instanceof ValidationError) {
      setValidation(e.message);
      setPhase("compose");
      return;
    }
    setFailure({
      message: e instanceof Error ? e.message : "Something went wrong.",
      backend: e instanceof BackendUnavailableError,
      retry,
    });
    setPhase(back === "compose" ? "error" : "error");
    announce("Analysis failed");
  };

  /* ----------------------------------------------------------------- runs */
  async function runOptimize(
    opts: { mode?: OptimizeMode; answers?: ClarificationAnswer[]; prior?: AnalysisResult; text?: string; eng?: Engine } = {},
  ) {
      const useMode = opts.mode ?? mode;
      const text = opts.text ?? prompt;
      const ctrl = begin(opts.prior ? ["optimize", "verify"] : ["scan", "classify", "diagnose", "optimize", "verify"]);
      try {
        const r = await intruva.optimize(
          { prompt: text, task_type: task, mode: useMode, target_model: model, answers: opts.answers ?? [] },
          { engine: opts.eng ?? engine, prior: opts.prior, onProgress: setStage, signal: ctrl.signal },
        );
        if (ctrl.signal.aborted) return;
        setResult(r);
        setAnalysis(r.analysis);
        setPhase("result");
        announce("Optimized prompt ready");
        scrollTop();
      } catch (e) {
        handleError(e, () => runOptimize(opts), "compose");
      }
  }

  async function runAnalyze(text = prompt, eng: Engine = engine) {
      const ctrl = begin(["scan", "classify", "diagnose"]);
      try {
        const a = await intruva.analyze(
          { prompt: text, task_type: task, mode: "deep", target_model: model },
          { engine: eng, onProgress: setStage, signal: ctrl.signal },
        );
        if (ctrl.signal.aborted) return;
        setAnalysis(a);
        setAnswers([]);
        setPhase("diagnosis");
        announce(`Diagnosis ready. ${a.questions.length} questions available.`);
        scrollTop();
      } catch (e) {
        handleError(e, () => runAnalyze(text, eng), "compose");
      }
  }

  const run = () => (mode === "deep" ? runAnalyze() : runOptimize());

  const cancel = () => {
    abortRef.current?.abort();
    setPhase(analysis && phase === "running" && stages[0] === "optimize" ? "diagnosis" : "compose");
  };

  const editOriginal = () => {
    abortRef.current?.abort();
    setPhase("compose");
    requestAnimationFrame(() => document.getElementById("prompt-input")?.focus());
  };

  const useDemoEngine = () => {
    setEngine("demo");
    toast("Switched to demo mode for this session", { tone: "info" });
    if (failure) {
      // re-run the same action on the demo engine
      if (mode === "deep") runAnalyze(prompt, "demo");
      else runOptimize({ eng: "demo" });
    }
  };

  /* ------------------------------------------------------------ redaction */
  const redactInPrompt = (findings: SecurityFinding[]) => {
    const prev = prompt;
    const next = applyRedactions(prompt, findings);
    setPrompt(next);
    toast(`Redacted ${findings.length} item${findings.length > 1 ? "s" : ""} in your prompt`, {
      action: {
        label: "Undo",
        onClick: () => {
          setPrompt(prev);
          if (phase === "diagnosis") runAnalyze(prev);
        },
      },
    });
    if (phase === "diagnosis") runAnalyze(next);
  };

  /* ---------------------------------------------------------------- render */
  const steps = mode === "deep" ? ["Write", "Diagnose", "Clarify", "Result"] : ["Write", "Result"];
  const stepIndex =
    phase === "compose" || phase === "error"
      ? 0
      : phase === "running"
        ? stages[0] === "optimize"
          ? steps.length - 1
          : Math.min(1, steps.length - 1)
        : phase === "diagnosis"
          ? 1
          : phase === "clarify"
            ? 2
            : steps.length - 1;

  const composing = phase === "compose";

  return (
    <div ref={topRef} className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      {/* Stepper + demo notice */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <ol className="flex items-center gap-1.5 text-xs" aria-label="Progress">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5" aria-current={i === stepIndex ? "step" : undefined}>
              <span
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 transition-colors duration-300",
                  i === stepIndex
                    ? "bg-white/[0.08] text-fg"
                    : i < stepIndex
                      ? "text-aqua-300"
                      : "text-fg-faint",
                )}
              >
                <span className="tabular-nums">{i + 1}</span>
                <span className={cn(i !== stepIndex && "hidden sm:inline")}>{s}</span>
              </span>
              {i < steps.length - 1 && <span className="h-px w-4 bg-white/10 sm:w-6" aria-hidden />}
            </li>
          ))}
        </ol>
        {engine === "demo" && (
          <p className="flex items-center gap-1.5 text-xs text-fg-muted">
            <FlaskConical className="size-3.5 text-warn" aria-hidden />
            Demo mode: rule-based engine, no AI model connected
          </p>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {composing ? (
          <m.div
            key="compose"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-3xl"
          >
            <h1 className="font-display text-[2rem] leading-[1.1] tracking-[-0.01em] text-fg sm:text-[2.6rem]">
              What should AI do <span className="italic text-aurora">for you?</span>
            </h1>
            <p className="mt-2 text-sm text-fg-muted sm:text-[0.95rem]">
              Paste your prompt as you&apos;d send it. Intruva diagnoses what&apos;s missing, keeps what you meant, and flags risks.
            </p>

            <GlassCard strong aurora sheen={false} className="mt-5 rounded-[1.6rem]">
              <div className="p-1.5 sm:p-2">
                <PromptEditor value={prompt} onChange={(v) => { setPrompt(v); setValidation(null); }} onSubmit={run} report={liveReport} error={validation} autoFocus />
              </div>
              <ControlStrip
                task={task}
                setTask={setTask}
                mode={mode}
                setMode={setMode}
                model={model}
                setModel={setModel}
                detected={task === "auto" ? detected : null}
                onRun={run}
              />
            </GlassCard>

            <section aria-labelledby="examples" className="mt-6">
              <h2 id="examples" className="mb-2.5 text-xs font-medium uppercase tracking-[0.16em] text-fg-faint">
                Try an example
              </h2>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                {SAMPLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setPrompt(s.prompt);
                      setValidation(null);
                      document.getElementById("prompt-input")?.focus({ preventScroll: true });
                    }}
                    title={s.pitch}
                    className="glass-subtle inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[0.8125rem] text-fg-soft transition-[background-color,transform,color] duration-150 hover:bg-white/[0.07] hover:text-fg active:scale-[0.97]"
                  >
                    <span className="text-fg-muted">{TASK_ICONS[s.family]}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </section>
          </m.div>
        ) : (
          <m.div
            key="work"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="grid gap-5 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-6"
          >
            {/* Original prompt — always accessible (plan §A5) */}
            <aside aria-label="Your original prompt" className="lg:sticky lg:top-20 lg:self-start">
              <OriginalCard
                prompt={prompt}
                findings={liveReport.findings}
                task={analysis?.task_type ? BLUEPRINTS[analysis.task_type].label : task === "auto" ? "Auto" : BLUEPRINTS[task].label}
                mode={MODE_OPTIONS.find((o) => o.value === mode)!.label}
                onEdit={editOriginal}
              />
            </aside>

            <div className="min-w-0">
              {phase === "running" && (
                <div className="animate-[fade-in_200ms_ease-out_220ms_both]">
                  <PipelineProgress stages={stages} current={stage} onCancel={cancel} />
                </div>
              )}

              {phase === "diagnosis" && analysis && (
                <DiagnosisView
                  analysis={analysis}
                  ctaMode="deep"
                  onAnswer={(field) => {
                    const i = field ? Math.max(0, analysis.questions.findIndex((q) => q.field === field)) : 0;
                    setClarifyStart(i);
                    setPhase("clarify");
                    scrollTop();
                  }}
                  onSkip={() =>
                    runOptimize({
                      mode: "deep",
                      prior: analysis,
                      answers: analysis.questions.map((q) => ({ field: q.field, kind: "skipped" as const })),
                    })
                  }
                  onRedact={(f) => redactInPrompt([f])}
                  onRedactAll={() => redactInPrompt(analysis.security.findings.filter((f) => f.redaction))}
                />
              )}

              {phase === "clarify" && analysis && (
                <ClarifyFlow
                  key={clarifyStart}
                  questions={analysis.questions}
                  answers={answers}
                  setAnswers={setAnswers}
                  startAt={clarifyStart}
                  onBack={() => setPhase("diagnosis")}
                  onFinish={(a) => runOptimize({ mode: "deep", prior: analysis, answers: a })}
                />
              )}

              {phase === "result" && result && (
                <ResultTabs
                  result={result}
                  mode={mode}
                  onEditOriginal={editOriginal}
                  onRerun={(m2) => {
                    setMode(m2);
                    if (m2 === "deep") runAnalyze();
                    else runOptimize({ mode: m2 });
                  }}
                />
              )}

              {phase === "error" && failure && (
                <ErrorState failure={failure} onEdit={editOriginal} onDemo={engine === "remote" ? useDemoEngine : undefined} />
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function OriginalCard({
  prompt,
  findings,
  task,
  mode,
  onEdit,
}: {
  prompt: string;
  findings: import("@/lib/contracts").SecurityFinding[];
  task: string;
  mode: string;
  onEdit: () => void;
}) {
  const body = (
    <>
      <div className="max-h-[50vh] overflow-auto rounded-xl border border-white/[0.06] bg-ink-950/30 p-3.5">
        <p className="editor-layer text-[0.8125rem] text-fg-soft">
          <Highlighted text={prompt} findings={findings} visible />
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Pill>{task}</Pill>
        <Pill>{mode}</Pill>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onEdit} icon={<PencilLine className="size-3.5" aria-hidden />}>
          Edit
        </Button>
      </div>
    </>
  );
  return (
    <>
      <GlassCard sheen={false} className="hidden p-4 lg:block">
        <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.14em] text-fg-faint">Your prompt</p>
        {body}
      </GlassCard>
      <div className="glass rounded-2xl px-4 py-3 lg:hidden">
        <Disclosure
          summary={
            <span className="block min-w-0">
              <span className="block text-xs font-medium uppercase tracking-[0.14em] text-fg-faint">Your prompt</span>
              <span className="mt-0.5 block truncate font-mono text-[0.8125rem] text-fg-soft">{prompt}</span>
            </span>
          }
        >
          <div className="pt-3">{body}</div>
        </Disclosure>
      </div>
    </>
  );
}

function ResultTabs({
  result,
  mode,
  onEditOriginal,
  onRerun,
}: {
  result: OptimizeResult;
  mode: OptimizeMode;
  onEditOriginal: () => void;
  onRerun: (m: OptimizeMode) => void;
}) {
  const [tab, setTab] = useState<"result" | "diagnosis">("result");
  return (
    <div>
      <div role="tablist" aria-label="Result sections" className="mb-4 flex gap-1 border-b border-white/[0.06]">
        {(
          [
            ["result", "Optimized prompt"],
            ["diagnosis", "Diagnosis"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            role="tab"
            type="button"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={cn(
              "relative -mb-px h-10 px-3.5 text-sm transition-colors",
              tab === v ? "text-fg" : "text-fg-muted hover:text-fg-soft",
            )}
          >
            {label}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[linear-gradient(90deg,var(--color-iris-400),var(--color-aqua-400))] transition-opacity",
                tab === v ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "result" ? (
          <ResultView key={result.request_id} result={result} mode={mode} onRerun={onRerun} onEditOriginal={onEditOriginal} />
        ) : (
          <DiagnosisView analysis={result.analysis} ctaMode="result" />
        )}
      </div>
    </div>
  );
}

function ErrorState({
  failure,
  onEdit,
  onDemo,
}: {
  failure: { message: string; backend: boolean; retry: () => void };
  onEdit: () => void;
  onDemo?: () => void;
}) {
  const Icon = failure.backend ? CloudOff : FileWarning;
  return (
    <GlassCard strong className="p-6 sm:p-8" role="alert">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-warn-soft text-warn">
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="mt-4 font-display text-2xl text-fg">
        {failure.backend ? "The Intruva engine is unreachable" : "That didn't work"}
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-fg-soft">
        {failure.message}{" "}
        {failure.backend
          ? "Your prompt is still here. Try again, or continue with the on-device demo engine."
          : "Your prompt is unchanged. Try again or adjust it."}
      </p>
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <Button variant="primary" onClick={failure.retry} icon={<RotateCcw className="size-4" aria-hidden />}>
          Try again
        </Button>
        {onDemo && (
          <Button onClick={onDemo} icon={<FlaskConical className="size-4" aria-hidden />}>
            Continue in demo mode
          </Button>
        )}
        <Button variant="ghost" onClick={onEdit} icon={<PencilLine className="size-4" aria-hidden />}>
          Edit prompt
        </Button>
      </div>
    </GlassCard>
  );
}
