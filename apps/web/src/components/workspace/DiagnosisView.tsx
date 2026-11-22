"use client";

import { m } from "motion/react";
import { useState } from "react";
import {
  ArrowRight,
  CircleCheck,
  CircleDashed,
  CircleDot,
  FileOutput,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Lock,
  MessageCircleQuestion,
  Target,
} from "lucide-react";
import type { AnalysisResult, MissingContext, ScoreDimension, SecurityFinding } from "@/lib/contracts";
import { cn } from "@/lib/cn";
import { SCORE_LABELS, SCORE_WEIGHTS } from "@/lib/engine/analyze";
import { BLUEPRINTS } from "@/lib/engine/taxonomy";
import { Button } from "../ui/Button";
import { Disclosure, GlassCard, Pill, ScoreBar, importanceTone, scoreWord } from "../ui/primitives";
import { TASK_ICONS } from "./options";
import { SecurityPanel } from "./SecurityPanel";

const DIMS = Object.keys(SCORE_WEIGHTS) as ScoreDimension[];

const rise = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay: 0.04 * i, ease: [0.16, 1, 0.3, 1] as const },
});

export function DiagnosisView({
  analysis,
  onAnswer,
  onSkip,
  onRedact,
  onRedactAll,
  ctaMode,
}: {
  analysis: AnalysisResult;
  /** Start clarification, optionally at a specific field. */
  onAnswer?: (field?: string) => void;
  onSkip?: () => void;
  onRedact?: (f: SecurityFinding) => void;
  onRedactAll?: () => void;
  /** "deep" shows the questions CTA; "result" is the read-only tab inside results. */
  ctaMode: "deep" | "result";
}) {
  const bp = BLUEPRINTS[analysis.task_type];
  const covered = analysis.coverage.filter((c) => c.covered === "yes").length;
  const qCount = analysis.questions.length;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <m.div {...rise(0)}>
        <GlassCard strong aurora className="overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[radial-gradient(circle,rgb(92_225_230/0.18),transparent_65%)] blur-2xl" />
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="iris" icon={TASK_ICONS[analysis.task_type]}>
              {bp.label}
            </Pill>
            <Pill tone={analysis.task_confidence === "high" ? "ok" : analysis.task_confidence === "medium" ? "aqua" : "warn"}>
              {analysis.task_confidence} confidence
            </Pill>
            <span className="text-xs text-fg-muted">{analysis.task_reason}</span>
          </div>
          <h2 className="mt-4 font-display text-2xl leading-tight text-fg sm:text-[1.75rem]">
            Prompt health: <span className="italic text-aurora">{scoreWord(analysis.scores.overall).toLowerCase()}</span>
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-fg-soft">
            {covered} of {analysis.coverage.length} context fields for {bp.label.toLowerCase()} are covered.
            {analysis.missing_context.length > 0
              ? ` ${analysis.missing_context.length} gap${analysis.missing_context.length > 1 ? "s" : ""} could change the answer. Ranked below by impact.`
              : " Nothing important is missing."}
          </p>

          {ctaMode === "deep" && (
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              {qCount > 0 ? (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => onAnswer?.()}
                    iconRight={<ArrowRight className="size-4" aria-hidden />}
                  >
                    Answer {qCount} quick question{qCount > 1 ? "s" : ""}
                  </Button>
                  <Button variant="secondary" size="lg" onClick={onSkip}>
                    Skip, use labelled assumptions
                  </Button>
                </>
              ) : (
                <Button variant="primary" size="lg" onClick={onSkip} iconRight={<ArrowRight className="size-4" aria-hidden />}>
                  Optimize now
                </Button>
              )}
            </div>
          )}
        </GlassCard>
      </m.div>

      {/* Score dimensions */}
      <m.section {...rise(1)} aria-labelledby="dims" className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 id="dims" className="text-sm font-medium text-fg">
            Quality dimensions
          </h3>
          <span className="text-xs text-fg-faint">Heuristic coverage, not a probability</span>
        </div>
        <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {DIMS.map((d) => (
            <ScoreBar key={d} label={SCORE_LABELS[d].label} hint={SCORE_LABELS[d].hint} value={analysis.scores[d]} />
          ))}
        </div>
        <Disclosure
          className="mt-4 border-t border-white/[0.06] pt-3"
          summaryClassName="text-xs text-fg-muted hover:text-fg-soft"
          summary={
            <span className="inline-flex items-center gap-1.5">
              <HelpCircle className="size-3.5" aria-hidden /> How is this scored?
            </span>
          }
        >
          <div className="pt-3 text-xs leading-relaxed text-fg-muted">
            <p>
              Each dimension checks whether your prompt covers what this task type usually needs. The overall figure is a
              weighted sum. It measures <em>coverage</em>, not the chance that the AI&apos;s answer will be correct.
              Security findings can lower the safety dimension regardless of the rest.
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
              {DIMS.map((d) => (
                <li key={d} className="flex justify-between gap-2">
                  <span>{SCORE_LABELS[d].label}</span>
                  <span className="tabular-nums text-fg-soft">{Math.round(SCORE_WEIGHTS[d] * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Disclosure>
      </m.section>

      {/* Missing context, ranked */}
      {analysis.missing_context.length > 0 && (
        <m.section {...rise(2)} aria-labelledby="gaps" className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="size-4 text-iris-300" aria-hidden />
            <h3 id="gaps" className="text-sm font-medium text-fg">
              Missing context, ranked by impact
            </h3>
          </div>
          <p className="mt-1 text-xs text-fg-muted">Tap any item to see why it matters and the question it answers.</p>
          <ol className="mt-4 space-y-2">
            {analysis.missing_context.map((mc, i) => (
              <GapItem
                key={mc.field}
                item={mc}
                rank={i + 1}
                asked={analysis.questions.some((q) => q.field === mc.field)}
                onAnswer={ctaMode === "deep" && onAnswer ? () => onAnswer(mc.field) : undefined}
              />
            ))}
          </ol>
        </m.section>
      )}

      {/* Insight cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Insight i={3} icon={<Target className="size-4" />} title="Intent" tone="iris">
          <p className="text-sm leading-relaxed text-fg-soft">{analysis.intent}</p>
        </Insight>

        <Insight i={4} icon={<ListChecks className="size-4" />} title="Context coverage" tone="aqua">
          <ul className="space-y-1.5">
            {analysis.coverage.map((c) => (
              <li key={c.field} className="flex items-start gap-2 text-sm">
                {c.covered === "yes" ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Covered" />
                ) : c.covered === "partial" ? (
                  <CircleDot className="mt-0.5 size-4 shrink-0 text-warn" aria-label="Assumed" />
                ) : (
                  <CircleDashed className="mt-0.5 size-4 shrink-0 text-fg-faint" aria-label="Missing" />
                )}
                <span className={cn(c.covered === "no" ? "text-fg-muted" : "text-fg-soft")}>
                  {c.label}
                  {c.required && <span className="ml-1.5 text-[0.7rem] text-fg-faint">required</span>}
                </span>
              </li>
            ))}
          </ul>
        </Insight>

        <Insight i={5} icon={<Lock className="size-4" />} title="Constraints you stated" tone="neutral">
          {analysis.constraints.length ? (
            <BulletList items={analysis.constraints} />
          ) : (
            <Empty>None detected. Limits such as “don&apos;t change the API” stop the AI from overreaching.</Empty>
          )}
        </Insight>

        <Insight i={6} icon={<FileOutput className="size-4" />} title="Output expectations" tone="neutral">
          {analysis.output_requirements.length ? (
            <BulletList items={analysis.output_requirements} />
          ) : (
            <Empty>No format requested. A {bp.label.toLowerCase()} default will be suggested.</Empty>
          )}
        </Insight>

        <Insight i={7} icon={<CircleCheck className="size-4" />} title="Known facts" tone="neutral">
          {analysis.known_facts.length ? (
            <ul className="space-y-1.5">
              {analysis.known_facts.map((f) => (
                <li key={f.text} className="flex items-start gap-2 text-sm text-fg-soft">
                  <Pill tone={f.source === "answer" ? "aqua" : "neutral"} className="shrink-0 px-2 py-0 text-[0.65rem]">
                    {f.source === "answer" ? "your answer" : "from prompt"}
                  </Pill>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Only the request itself was found. No supporting facts yet.</Empty>
          )}
        </Insight>

        <Insight i={8} icon={<Lightbulb className="size-4" />} title="Assumptions if you skip" tone="warn">
          {analysis.assumptions.length ? (
            <ul className="space-y-2">
              {analysis.assumptions.map((a) => (
                <li key={a.field} className="text-sm leading-relaxed text-fg-soft">
                  <Pill tone="warn" className="mr-1.5 px-2 py-0 text-[0.65rem]">
                    assumed
                  </Pill>
                  {a.text}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No assumptions needed.</Empty>
          )}
        </Insight>
      </div>

      <m.div {...rise(9)}>
        <SecurityPanel report={analysis.security} onRedact={onRedact} onRedactAll={onRedactAll} />
      </m.div>
    </div>
  );
}

function GapItem({
  item,
  rank,
  asked,
  onAnswer,
}: {
  item: MissingContext;
  rank: number;
  asked: boolean;
  onAnswer?: () => void;
}) {
  const [open, setOpen] = useState(rank === 1);
  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.02] transition-colors hover:bg-white/[0.035]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs tabular-nums text-fg-soft">
          {rank}
        </span>
        <span className="min-w-0 flex-1 text-sm text-fg">{item.label}</span>
        <Pill tone={importanceTone[item.importance]}>{item.importance} impact</Pill>
      </button>
      {open && (
        <m.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="space-y-2 px-3.5 pb-3.5 pl-[3.25rem] text-[0.8125rem] leading-relaxed">
            <p className="text-fg-soft">{item.why}</p>
            <p className="text-fg">
              <span className="text-fg-muted">Question: </span>
              {item.question}
            </p>
            <p className="text-fg-muted">
              <span className="text-warn/90">If skipped: </span>
              {item.assumption}
            </p>
            {onAnswer && asked && (
              <button
                type="button"
                onClick={onAnswer}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-aqua-300 hover:bg-white/[0.05]"
              >
                Answer this now <ArrowRight className="size-3" aria-hidden />
              </button>
            )}
          </div>
        </m.div>
      )}
    </li>
  );
}

function Insight({
  i,
  icon,
  title,
  tone,
  children,
}: {
  i: number;
  icon: React.ReactNode;
  title: string;
  tone: "iris" | "aqua" | "warn" | "neutral";
  children: React.ReactNode;
}) {
  const toneCls = {
    iris: "bg-iris-500/15 text-iris-300",
    aqua: "bg-aqua-400/12 text-aqua-300",
    warn: "bg-warn-soft text-warn",
    neutral: "bg-white/[0.06] text-fg-soft",
  }[tone];
  return (
    <m.section {...rise(i)} className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={cn("flex size-7 items-center justify-center rounded-lg", toneCls)} aria-hidden>
          {icon}
        </span>
        <h3 className="text-sm font-medium text-fg">{title}</h3>
      </div>
      {children}
    </m.section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2 text-sm leading-relaxed text-fg-soft">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-fg-muted" aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-fg-muted">{children}</p>;
}
