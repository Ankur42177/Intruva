"use client";

import { m } from "motion/react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Copy,
  Download,
  Lightbulb,
  MessageSquareHeart,
  PencilLine,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Undo2,
} from "lucide-react";
import type { OptimizeMode, OptimizeResult, PreservationCheck, ScoreDimension, SecurityFinding } from "@/lib/contracts";
import { feedbackUrl } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { SCORE_LABELS, SCORE_WEIGHTS } from "@/lib/engine/analyze";
import { BLUEPRINTS } from "@/lib/engine/taxonomy";
import { applyRedactions, scanPrompt } from "@/lib/security/scan";
import { Button } from "../ui/Button";
import { Disclosure, GlassCard, Pill, ScoreBar, SegmentedControl, scoreWord } from "../ui/primitives";
import { useToast } from "../ui/Toast";
import { MODE_OPTIONS, TASK_ICONS } from "./options";
import { PromptText } from "./PromptText";
import { SecurityPanel } from "./SecurityPanel";

const DiffView = dynamic(() => import("./DiffView"), {
  loading: () => (
    <div className="space-y-2" aria-hidden>
      <div className="skeleton h-3 w-40" />
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-4/5" />
    </div>
  ),
});

type View = "optimized" | "compare" | "diff";

const rise = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] as const },
});

export function ResultView({
  result,
  mode,
  onRerun,
  onEditOriginal,
}: {
  result: OptimizeResult;
  mode: OptimizeMode;
  onRerun: (mode: OptimizeMode) => void;
  onEditOriginal: () => void;
}) {
  const { toast } = useToast();
  const [view, setView] = useState<View>("optimized");
  const [mobilePane, setMobilePane] = useState<"original" | "optimized">("optimized");
  const [text, setText] = useState(result.optimized);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(result.optimized);
  const [copied, setCopied] = useState(false);

  const edited = text !== result.optimized;
  const security = useMemo(() => (edited ? scanPrompt(text) : result.security_after), [edited, text, result.security_after]);
  const bp = BLUEPRINTS[result.analysis.task_type];
  const fails = result.preservation.filter((p) => p.status === "fail").length;
  const warns = result.preservation.filter((p) => p.status === "warn").length;
  const passed = result.preservation.length - fails - warns;
  const deltaPts = Math.round((result.scores_after.overall - result.scores_before.overall) * 100);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    toast("Optimized prompt copied. Paste it into your AI of choice.");
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intruva-${bp.short.toLowerCase()}-prompt.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Downloaded as Markdown", { tone: "info" });
  };

  const startEdit = () => {
    setDraft(text);
    setEditing(true);
  };
  const saveEdit = () => {
    setText(draft);
    setEditing(false);
    toast("Edits saved", { tone: "info" });
  };
  const resetEdits = () => {
    const prev = text;
    setText(result.optimized);
    setEditing(false);
    toast("Reset to the generated prompt", { tone: "info", action: { label: "Undo", onClick: () => setText(prev) } });
  };
  const redact = (findings: SecurityFinding[]) => {
    const prev = text;
    setText(applyRedactions(text, findings));
    toast(`Redacted ${findings.length} item${findings.length > 1 ? "s" : ""} in the optimized prompt`, {
      action: { label: "Undo", onClick: () => setText(prev) },
    });
  };

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      {/* ---------------------------------------------------- focal card */}
      <m.div {...rise(0)}>
        <GlassCard strong aurora sheen={false} className="overflow-hidden">
          <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-[radial-gradient(circle,rgb(127_108_255/0.22),transparent_65%)] blur-2xl" />
          <div className="relative p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="iris" icon={TASK_ICONS[result.analysis.task_type]}>
                {bp.label}
              </Pill>
              <Pill tone={fails ? "risk" : warns ? "warn" : "ok"} icon={fails ? <CircleX className="size-3.5" /> : <CircleCheck className="size-3.5" />}>
                Intent {fails ? `${fails} check failed` : `${passed}/${result.preservation.length} checks passed`}
              </Pill>
              <Pill
                tone={security.findings.length ? (security.risk_level === "high" || security.risk_level === "critical" ? "risk" : "warn") : "ok"}
                icon={<ShieldCheck className="size-3.5" />}
              >
                {security.findings.length ? `${security.findings.length} security finding${security.findings.length > 1 ? "s" : ""}` : "No security findings"}
              </Pill>
              {deltaPts > 0 && (
                <Pill tone="aqua" icon={<Sparkles className="size-3.5" />} title="Heuristic coverage score, not a quality guarantee">
                  Coverage {Math.round(result.scores_before.overall * 100)} → {Math.round(result.scores_after.overall * 100)}
                </Pill>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-2xl leading-tight text-fg sm:text-[1.75rem]">
                Your <span className="italic text-aurora">optimized</span> prompt
              </h2>
              <SegmentedControl
                label="Result view"
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: "optimized", label: "Optimized" },
                  { value: "compare", label: "Compare" },
                  { value: "diff", label: "Diff" },
                ]}
              />
            </div>

            {/* Action bar (desktop) */}
            <div className="mt-4 hidden flex-wrap items-center gap-2 sm:flex">
              <Button
                variant="primary"
                size="sm"
                onClick={copy}
                icon={copied ? <ClipboardCheck className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              >
                {copied ? "Copied" : "Copy prompt"}
              </Button>
              {!editing && (
                <Button size="sm" onClick={startEdit} icon={<PencilLine className="size-4" aria-hidden />}>
                  Edit
                </Button>
              )}
              {edited && !editing && (
                <Button size="sm" variant="ghost" onClick={resetEdits} icon={<Undo2 className="size-4" aria-hidden />}>
                  Reset edits
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={download} icon={<Download className="size-4" aria-hidden />}>
                Download .md
              </Button>
              <Button size="sm" variant="ghost" onClick={onEditOriginal} icon={<RotateCcw className="size-4" aria-hidden />}>
                Edit original
              </Button>
            </div>
          </div>

          <div className="relative border-t border-white/[0.06] bg-ink-950/25 p-5 sm:p-6">
            {editing ? (
              <div>
                <label htmlFor="opt-edit" className="sr-only">
                  Edit optimized prompt
                </label>
                <textarea
                  id="opt-edit"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                  rows={Math.min(28, draft.split("\n").length + 2)}
                  className="w-full resize-y rounded-xl border border-iris-400/40 bg-ink-950/40 p-4 font-mono text-[0.875rem] leading-[1.75] text-fg outline-none focus:shadow-[0_0_0_4px_rgb(157_143_255/0.12)]"
                />
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="primary" onClick={saveEdit}>
                    Save edits
                  </Button>
                </div>
              </div>
            ) : view === "optimized" ? (
              <PromptText text={text} />
            ) : view === "compare" ? (
              <>
                <div className="mb-4 sm:hidden">
                  <SegmentedControl
                    label="Which version"
                    size="sm"
                    value={mobilePane}
                    onChange={setMobilePane}
                    options={[
                      { value: "original", label: "Original" },
                      { value: "optimized", label: "Optimized" },
                    ]}
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <section className={cn(mobilePane === "optimized" && "hidden sm:block")} aria-label="Original prompt">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-fg-faint">Original</p>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="whitespace-pre-wrap font-mono text-[0.875rem] leading-[1.75] text-fg-soft [overflow-wrap:anywhere]">
                        {result.original}
                      </p>
                    </div>
                  </section>
                  <section className={cn(mobilePane === "original" && "hidden sm:block")} aria-label="Optimized prompt">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-aqua-300/80">Optimized</p>
                    <div className="rounded-xl border border-aqua-400/15 bg-aqua-400/[0.03] p-4">
                      <PromptText text={text} />
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <DiffView original={result.original} optimized={text} />
            )}
          </div>
        </GlassCard>
      </m.div>

      {/* Re-run strip */}
      <m.div {...rise(1)} className="glass-subtle flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
        <p className="text-sm text-fg-soft">
          Try another approach
          <span className="block text-xs text-fg-muted">Re-runs on the same prompt with a different mode.</span>
        </p>
        <div className="sm:ml-auto">
          <SegmentedControl label="Re-run with mode" size="sm" value={mode} onChange={onRerun} options={MODE_OPTIONS} />
        </div>
      </m.div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Changes */}
        <m.section {...rise(2)} aria-labelledby="changes" className="glass rounded-2xl p-5">
          <h3 id="changes" className="text-sm font-medium text-fg">
            What changed and why
          </h3>
          <ul className="mt-3 space-y-1">
            {result.changes.map((c) => (
              <li key={c.kind + c.title}>
                <Disclosure
                  summaryClassName="rounded-lg px-2 py-2 -mx-2 hover:bg-white/[0.03]"
                  summary={
                    <span className="flex items-center gap-2 text-sm text-fg-soft">
                      <Sparkles className="size-3.5 shrink-0 text-aqua-300" aria-hidden />
                      {c.title}
                    </span>
                  }
                >
                  <p className="pb-2 pl-5.5 text-[0.8125rem] leading-relaxed text-fg-muted">{c.detail}</p>
                </Disclosure>
              </li>
            ))}
            {result.changes.length === 0 && <li className="text-sm text-fg-muted">No changes were needed.</li>}
          </ul>
        </m.section>

        {/* Preservation */}
        <m.section {...rise(3)} aria-labelledby="preserve" className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 id="preserve" className="text-sm font-medium text-fg">
              Intent preservation
            </h3>
            <span className="text-xs text-fg-muted">
              {passed} passed{warns ? ` · ${warns} to review` : ""}
              {fails ? ` · ${fails} failed` : ""}
            </span>
          </div>
          <ul className="mt-3 space-y-2.5">
            {result.preservation.map((p) => (
              <PreservationRow key={p.id} check={p} />
            ))}
          </ul>
        </m.section>

        {/* Scores */}
        <m.section {...rise(4)} aria-labelledby="scores" className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 id="scores" className="text-sm font-medium text-fg">
              Quality dimensions
            </h3>
            <span className="text-xs text-fg-muted">
              {scoreWord(result.scores_before.overall)} → <span className="text-fg">{scoreWord(result.scores_after.overall)}</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-fg-faint">
            Grey shows before. Missing context counts as half until you supply it.
          </p>
          <div className="mt-4 space-y-3.5">
            {(Object.keys(SCORE_WEIGHTS) as ScoreDimension[]).map((d) => (
              <ScoreBar
                key={d}
                label={SCORE_LABELS[d].label}
                hint={SCORE_LABELS[d].hint}
                value={result.scores_after[d]}
                before={result.scores_before[d]}
              />
            ))}
          </div>
        </m.section>

        {/* Assumptions */}
        <m.section {...rise(5)} aria-labelledby="assumed" className="glass rounded-2xl p-5">
          <h3 id="assumed" className="flex items-center gap-2 text-sm font-medium text-fg">
            <Lightbulb className="size-4 text-warn" aria-hidden /> Labelled assumptions
          </h3>
          {result.assumptions_used.length ? (
            <>
              <p className="mt-1 text-xs text-fg-muted">
                These are written into the prompt as assumptions for the AI to confirm, never as facts.
              </p>
              <ul className="mt-3 space-y-2">
                {result.assumptions_used.map((a) => (
                  <li key={a.field} className="rounded-xl border border-warn/10 bg-warn-soft/40 px-3 py-2 text-[0.8125rem] leading-relaxed text-fg-soft">
                    {a.text}
                  </li>
                ))}
              </ul>
              {mode !== "deep" && (
                <button
                  type="button"
                  onClick={() => onRerun("deep")}
                  className="mt-3 text-xs font-medium text-aqua-300 hover:underline"
                >
                  Replace assumptions with real answers in Deep mode →
                </button>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-fg-muted">No assumptions were needed. Everything came from your prompt or answers.</p>
          )}
        </m.section>
      </div>

      <m.div {...rise(6)}>
        <SecurityPanel
          report={security}
          title="Security check on the optimized prompt"
          note={
            security.findings.some((f) => f.redaction)
              ? "Your optimized prompt still contains the sensitive values from your original. Redact them before pasting it anywhere."
              : undefined
          }
          onRedact={(f) => redact([f])}
          onRedactAll={() => redact(security.findings.filter((f) => f.redaction))}
        />
      </m.div>

      {feedbackUrl && (
        <m.section {...rise(7)} className="glass flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center">
          <MessageSquareHeart className="size-5 shrink-0 text-iris-300" aria-hidden />
          <p className="flex-1 text-sm text-fg-soft">
            Did this help? Tell us in 30 seconds.
            <span className="block text-xs text-fg-muted">The form never receives your prompt text.</span>
          </p>
          <div className="flex gap-2">
            <a
              href={`${feedbackUrl}${feedbackUrl.includes("?") ? "&" : "?"}rating=up&task=${result.analysis.task_type}&mode=${mode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-subtle inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm text-fg hover:bg-white/[0.07]"
            >
              <ThumbsUp className="size-4" aria-hidden /> Helpful
            </a>
            <a
              href={`${feedbackUrl}${feedbackUrl.includes("?") ? "&" : "?"}rating=down&task=${result.analysis.task_type}&mode=${mode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-subtle inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm text-fg hover:bg-white/[0.07]"
            >
              <ThumbsDown className="size-4" aria-hidden /> Not quite
            </a>
          </div>
        </m.section>
      )}

      {/* Mobile sticky action bar: thumb-reachable (plan §29.3) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-ink-950/80 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:hidden">
        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1"
            onClick={copy}
            icon={copied ? <ClipboardCheck className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          >
            {copied ? "Copied" : "Copy prompt"}
          </Button>
          <Button onClick={editing ? saveEdit : startEdit} aria-label={editing ? "Save edits" : "Edit prompt"} icon={<PencilLine className="size-4" aria-hidden />}>
            {editing ? "Save" : null}
          </Button>
          {edited && !editing && (
            <Button onClick={resetEdits} aria-label="Reset edits" icon={<Undo2 className="size-4" aria-hidden />} />
          )}
          <Button onClick={download} aria-label="Download as Markdown" icon={<Download className="size-4" aria-hidden />} />
          <Button onClick={onEditOriginal} aria-label="Edit original prompt" icon={<RotateCcw className="size-4" aria-hidden />} />
        </div>
      </div>
    </div>
  );
}

function PreservationRow({ check }: { check: PreservationCheck }) {
  const Icon = check.status === "pass" ? CircleCheck : check.status === "warn" ? CircleAlert : CircleX;
  const tone = check.status === "pass" ? "text-ok" : check.status === "warn" ? "text-warn" : "text-risk";
  return (
    <li className="flex items-start gap-2.5">
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm text-fg">
          {check.label}
          <span className="sr-only">: {check.status === "pass" ? "passed" : check.status === "warn" ? "needs review" : "failed"}</span>
        </span>
        <span className="block text-xs leading-relaxed text-fg-muted">{check.detail}</span>
      </span>
    </li>
  );
}
