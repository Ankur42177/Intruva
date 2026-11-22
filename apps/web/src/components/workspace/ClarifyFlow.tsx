"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleDashed, Lightbulb, SkipForward, Sparkles } from "lucide-react";
import type { ClarificationAnswer, MissingContext } from "@/lib/contracts";
import { cn } from "@/lib/cn";
import { Button } from "../ui/Button";
import { GlassCard, Kbd, Pill, importanceTone } from "../ui/primitives";

/**
 * Plan §15.5: one question at a time (1–3 total), explain the impact, offer
 * answer / skip / accept assumption, chips for fast answers, preserve answers
 * when navigating back, light transitions.
 */
export function ClarifyFlow({
  questions,
  answers,
  setAnswers,
  startAt = 0,
  onFinish,
  onBack,
}: {
  questions: MissingContext[];
  answers: ClarificationAnswer[];
  setAnswers: (a: ClarificationAnswer[]) => void;
  startAt?: number;
  onFinish: (answers: ClarificationAnswer[]) => void;
  onBack: () => void;
}) {
  const [index, setIndex] = useState(startAt);
  const [dir, setDir] = useState(1);
  const q = questions[index];
  const existing = answers.find((a) => a.field === q.field);
  const [draft, setDraft] = useState(existing?.kind === "answered" ? existing.value ?? "" : "");
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, [index]);

  const record = (a: ClarificationAnswer) => {
    const next = [...answers.filter((x) => x.field !== a.field), a];
    setAnswers(next);
    return next;
  };

  const go = (to: number, next: ClarificationAnswer[]) => {
    if (to >= questions.length) {
      onFinish(next);
      return;
    }
    setDir(to > index ? 1 : -1);
    const nextExisting = next.find((a) => a.field === questions[to].field);
    setDraft(nextExisting?.kind === "answered" ? nextExisting.value ?? "" : "");
    setIndex(to);
  };

  const submit = () => {
    const v = draft.trim();
    go(index + 1, record(v ? { field: q.field, kind: "answered", value: v } : { field: q.field, kind: "skipped" }));
  };
  const skip = () => go(index + 1, record({ field: q.field, kind: "skipped" }));
  const assume = () => go(index + 1, record({ field: q.field, kind: "assumed" }));
  const back = () => (index === 0 ? onBack() : go(index - 1, answers));

  const pickChip = (s: string) => {
    setDraft((d) => (d.trim() && !d.includes(s) ? `${d.trim()}; ${s}` : s));
    input.current?.focus();
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <GlassCard strong aurora className="overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgb(127_108_255/0.2),transparent_65%)] blur-2xl" />

        {/* progress */}
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-fg-muted">
            Question {index + 1} of {questions.length}
          </span>
          <div className="flex flex-1 gap-1.5" aria-hidden>
            {questions.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  i < index ? "bg-aqua-400/70" : i === index ? "bg-iris-400" : "bg-white/10",
                )}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <m.div
            key={q.field}
            custom={dir}
            initial={{ opacity: 0, x: 24 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 * dir }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={importanceTone[q.importance]}>{q.importance} impact</Pill>
              <span className="text-xs text-fg-muted">{q.label}</span>
            </div>
            <h2 className="mt-3 font-display text-2xl leading-snug text-fg sm:text-3xl" id={`q-${q.field}`}>
              {q.question}
            </h2>
            <p className="mt-3 flex gap-2 text-sm leading-relaxed text-fg-soft">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-aqua-300" aria-hidden />
              <span>
                <span className="text-fg-muted">Why this matters: </span>
                {q.why}
              </span>
            </p>

            <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Suggested answers">
              {q.suggested_answers.map((s) => {
                const on = draft.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pickChip(s)}
                    className={cn(
                      "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[0.8125rem] transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]",
                      on
                        ? "border-aqua-400/50 bg-aqua-400/12 text-aqua-300"
                        : "border-white/10 bg-white/[0.035] text-fg-soft hover:border-white/20 hover:bg-white/[0.07] hover:text-fg",
                    )}
                  >
                    {on && <Check className="size-3.5" aria-hidden />}
                    {s}
                  </button>
                );
              })}
            </div>

            <label htmlFor={`a-${q.field}`} className="sr-only">
              Your answer
            </label>
            <textarea
              id={`a-${q.field}`}
              ref={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              aria-labelledby={`q-${q.field}`}
              placeholder="Type an answer, or pick a suggestion above…"
              className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[0.95rem] leading-relaxed text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-faint focus:border-iris-400/50 focus:shadow-[0_0_0_4px_rgb(157_143_255/0.1)]"
            />

            <div className="mt-3 rounded-xl border border-warn/15 bg-warn-soft/50 px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-fg-soft">
              <span className="inline-flex items-center gap-1.5 font-medium text-warn">
                <Lightbulb className="size-3.5" aria-hidden /> Assumption if you skip:
              </span>{" "}
              {q.assumption}
            </div>
          </m.div>
        </AnimatePresence>

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center">
          <Button variant="ghost" onClick={back} icon={<ArrowLeft className="size-4" aria-hidden />}>
            {index === 0 ? "Diagnosis" : "Back"}
          </Button>
          <div className="flex flex-1 flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={skip} icon={<SkipForward className="size-4" aria-hidden />}>
              Skip
            </Button>
            <Button variant="secondary" onClick={assume} icon={<Lightbulb className="size-4" aria-hidden />}>
              Use assumption
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              disabled={!draft.trim()}
              iconRight={<ArrowRight className="size-4" aria-hidden />}
            >
              {index === questions.length - 1 ? "Optimize" : "Next"}
            </Button>
          </div>
        </div>
        <p className="mt-3 hidden text-right text-xs text-fg-faint sm:block">
          <Kbd>↵</Kbd> to continue · <Kbd>⇧</Kbd> <Kbd>↵</Kbd> new line
        </p>
      </GlassCard>

      {/* Overview of all questions */}
      <aside aria-label="Questions overview" className="glass hidden self-start rounded-2xl p-4 lg:block">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-faint">Your answers</p>
        <ol className="mt-3 space-y-2">
          {questions.map((qq, i) => {
            const a = answers.find((x) => x.field === qq.field);
            return (
              <li key={qq.field}>
                <button
                  type="button"
                  onClick={() => go(i, answers)}
                  aria-current={i === index ? "step" : undefined}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[0.8125rem] transition-colors",
                    i === index ? "bg-white/[0.06] text-fg" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg-soft",
                  )}
                >
                  {a?.kind === "answered" ? (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-ok" aria-label="Answered" />
                  ) : a ? (
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-warn" aria-label="Assumed" />
                  ) : (
                    <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-fg-faint" aria-label="Not answered yet" />
                  )}
                  <span className="min-w-0">
                    <span className="block">{qq.label}</span>
                    {a?.kind === "answered" && <span className="block truncate text-xs text-fg-muted">{a.value}</span>}
                    {a && a.kind !== "answered" && <span className="block text-xs text-fg-faint">assumption</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
