/**
 * Thin, pure layer between the MCP tools and `@intruva/engine`.
 *
 * Adds three things the raw engine doesn't do on its own:
 *  - optional redaction of secrets / PII *before* analysis, so credentials are
 *    never echoed back in tool output (findings still come from the original);
 *  - open-question selection for the optimize step, independent of mode;
 *  - result shapes that match the declared MCP output schemas.
 *
 * Nothing here logs, touches the network, or reads files.
 */
import {
  analyzeLocal,
  applyRedactions,
  BLUEPRINTS,
  ENGINE_VERSION,
  optimizeLocal,
  SAMPLES,
  scanPrompt,
  TASK_ORDER,
  validatePrompt,
  type AnalysisResult,
  type ClarificationAnswer,
  type FindingCategory,
  type SecurityFinding,
  type OptimizeMode,
  type SecurityReport,
  type TargetModel,
  type TaskFamily,
  type TaskSelection,
} from "@intruva/engine";
import { safetyScore, selectQuestions, weighted } from "@intruva/engine/engine/analyze";

export const MAX_SCAN_CHARS = 100_000;

export const ENGINE_INFO = {
  name: "intruva-local" as const,
  version: ENGINE_VERSION,
  kind: "rule-based" as const,
};

/** Errors whose message is safe and useful to show to the user verbatim. */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

/* ---------------------------------------------------------------- redaction */

export interface RedactionInfo {
  applied: boolean;
  count: number;
  categories: FindingCategory[];
  note: string;
}

interface RedactPolicy {
  secrets: boolean;
  pii: boolean;
}

/**
 * Apply redactions, but leave trailing sentence punctuation outside the
 * placeholder. Some engine patterns (e.g. connection strings) swallow a
 * trailing "." — replacing it would merge two sentences, which changes how the
 * optimizer splits and quarantines the prompt.
 */
export function redact(text: string, findings: SecurityFinding[]): string {
  const adjusted = findings
    .filter((f) => f.redaction)
    .map((f) => {
      const tail = /[.,;:)\]]+$/.exec(text.slice(f.span.start, f.span.end));
      const end = tail ? f.span.end - tail[0].length : f.span.end;
      return end > f.span.start ? { ...f, span: { start: f.span.start, end } } : f;
    });
  return applyRedactions(text, adjusted);
}

function redactText(text: string, policy: RedactPolicy, report: SecurityReport = scanPrompt(text)) {
  const picked = report.findings.filter(
    (f) => f.redaction && ((policy.secrets && f.category === "secret") || (policy.pii && f.category === "pii")),
  );
  return { text: picked.length ? redact(text, picked) : text, picked };
}

function redactionInfo(count: number, categories: Set<FindingCategory>, policy: RedactPolicy): RedactionInfo {
  const what = [policy.secrets && "secrets", policy.pii && "personal data"].filter(Boolean).join(" and ");
  let note: string;
  if (count) note = `Replaced ${count} detected value(s) with placeholders before analysis; the raw values are not included in this output.`;
  else if (what) note = `No ${what} needed redaction.`;
  else note = "Redaction was turned off; detected values may appear verbatim in this output.";
  return { applied: count > 0, count, categories: [...categories], note };
}

/* ------------------------------------------------------------------ analyze */

export interface AnalyzeArgs {
  prompt: string;
  task_type: TaskSelection;
  mode: OptimizeMode;
  redact_secrets: boolean;
  redact_pii: boolean;
}

interface Prepared {
  analysis: AnalysisResult;
  text: string;
  original: SecurityReport;
  redaction: RedactionInfo;
  policy: RedactPolicy;
  categories: Set<FindingCategory>;
}

function prepare(
  prompt: string,
  task_type: TaskSelection,
  mode: OptimizeMode,
  target_model: TargetModel,
  policy: RedactPolicy,
): Prepared {
  validatePrompt(prompt);
  const original = scanPrompt(prompt);
  const { text, picked } = redactText(prompt, policy, original);
  const analysis = analyzeLocal({ prompt: text, task_type, mode, target_model });
  if (picked.length) {
    // The analysis ran on the redacted text; report risk from the original.
    analysis.security = original;
    const { overall: _drop, ...dims } = analysis.scores;
    dims.safety = safetyScore(original);
    analysis.scores = { ...dims, overall: weighted(dims) };
  }
  const categories = new Set(picked.map((f) => f.category));
  return {
    analysis,
    text,
    original,
    policy,
    categories,
    redaction: redactionInfo(picked.length, categories, policy),
  };
}

export function analyze(args: AnalyzeArgs) {
  const policy = { secrets: args.redact_secrets, pii: args.redact_pii };
  const { analysis: a, redaction } = prepare(args.prompt, args.task_type, args.mode, "generic", policy);
  const bp = BLUEPRINTS[a.task_type];

  let next_step: string;
  if (a.questions.length)
    next_step =
      "Ask the user the questions in `questions` (they may skip any), then call intruva_optimize_prompt with the same prompt and their replies in `answers` (use each question's `field` id).";
  else if (args.mode !== "deep" && a.missing_context.length)
    next_step =
      "Call again with mode \"deep\" to get ranked clarification questions, or call intruva_optimize_prompt now to fill gaps with labelled assumptions.";
  else next_step = "Call intruva_optimize_prompt with the same prompt to build the structured version.";
  if (severityAtLeast(a.security.risk_level, "high"))
    next_step = `Security risk is ${a.security.risk_level}: warn the user and suggest removing or redacting the flagged content before sending this prompt anywhere. ${next_step}`;

  return {
    engine: ENGINE_INFO,
    request_id: a.request_id,
    task_type: a.task_type,
    task_label: bp.label,
    task_confidence: a.task_confidence,
    task_reason: a.task_reason,
    intent: a.intent,
    completeness: round2(a.completeness),
    scores: a.scores,
    requires_clarification: a.requires_clarification,
    questions: a.questions,
    missing_context: a.missing_context,
    known_facts: a.known_facts,
    constraints: a.constraints,
    output_requirements: a.output_requirements,
    assumptions: a.assumptions,
    coverage: a.coverage,
    security: a.security,
    redaction,
    next_step,
  };
}

export type AnalyzeOutput = ReturnType<typeof analyze>;

/* ----------------------------------------------------------------- optimize */

export interface AnswerArg {
  field: string;
  kind: "answered" | "skipped" | "assumed";
  value?: string;
}

export interface OptimizeArgs extends AnalyzeArgs {
  target_model: TargetModel;
  answers: AnswerArg[];
}

export function optimize(args: OptimizeArgs) {
  for (const a of args.answers) {
    if (a.kind === "answered" && !a.value?.trim())
      throw new InputError(`Answer for field "${a.field}" has kind "answered" but no value. Add the user's answer, or use kind "skipped".`);
  }
  const policy = { secrets: args.redact_secrets, pii: args.redact_pii };
  const prep = prepare(args.prompt, args.task_type, args.mode, args.target_model, policy);

  // Answers flow into the optimized prompt verbatim, so apply the same policy.
  let extra = 0;
  const answers: ClarificationAnswer[] = args.answers.map((a) => {
    if (!a.value) return { field: a.field, kind: a.kind };
    const { text, picked } = redactText(a.value, policy);
    extra += picked.length;
    picked.forEach((f) => prep.categories.add(f.category));
    return { field: a.field, kind: a.kind, value: text.trim() };
  });

  const task_type: TaskFamily = prep.analysis.task_type;
  const r = optimizeLocal(
    { prompt: prep.text, task_type, mode: args.mode, target_model: args.target_model, answers },
    prep.analysis,
  );

  const bp = BLUEPRINTS[task_type];
  const known = new Set(bp.fields.map((f) => f.field));
  const addressed = new Set(answers.map((a) => a.field));
  const open_questions = selectQuestions(r.analysis.missing_context.filter((m) => !addressed.has(m.field)));
  const tally = { pass: 0, warn: 0, fail: 0 };
  for (const p of r.preservation) tally[p.status] += 1;

  return {
    engine: ENGINE_INFO,
    request_id: r.request_id,
    optimized: r.optimized,
    task_type,
    task_label: bp.label,
    task_confidence: prep.analysis.task_confidence,
    mode: args.mode,
    target_model: args.target_model,
    changes: r.changes,
    preservation: r.preservation,
    preservation_summary: tally,
    scores_before: r.scores_before,
    scores_after: r.scores_after,
    assumptions_used: r.assumptions_used,
    open_questions,
    unmatched_answer_fields: answers.filter((a) => !known.has(a.field)).map((a) => a.field),
    security_before: prep.original,
    security_after: r.security_after,
    redaction: redactionInfo(prep.redaction.count + extra, prep.categories, policy),
  };
}

export type OptimizeOutput = ReturnType<typeof optimize>;

/* --------------------------------------------------------------------- scan */

export function scan(args: { prompt: string; redact: boolean }) {
  if (!args.prompt.trim()) throw new InputError("Add some text to scan.");
  if (args.prompt.length > MAX_SCAN_CHARS)
    throw new InputError(`Text is limited to ${MAX_SCAN_CHARS.toLocaleString("en-US")} characters per scan. Split it and scan each part.`);
  const report = scanPrompt(args.prompt);
  const counts = {
    secret: 0,
    pii: 0,
    prompt_injection: 0,
    exfiltration: 0,
    tool_misuse: 0,
    instruction_conflict: 0,
  } satisfies Record<FindingCategory, number>;
  for (const f of report.findings) counts[f.category] += 1;
  const out = {
    engine: ENGINE_INFO,
    risk_level: report.risk_level,
    finding_count: report.findings.length,
    counts_by_category: counts,
    findings: report.findings,
    limitations: report.limitations,
  };
  if (!args.redact) return out;
  const redactable = report.findings.filter((f) => f.redaction);
  return {
    ...out,
    redacted_text: redact(args.prompt, redactable),
    redactions_applied: redactable.length,
  };
}

export type ScanOutput = ReturnType<typeof scan>;

/* --------------------------------------------------------------- task types */

export const MODE_DESCRIPTIONS: Record<OptimizeMode, string> = {
  quick: "Full structured prompt (goal, context, steps, constraints, assumptions, output, success criteria). No questions.",
  deep: "Same structure, plus up to 3 ranked clarification questions at analysis time and low-importance assumptions listed.",
  minimal: "Keeps the prompt exactly as written and appends only a one-line output format and an ask to state assumptions.",
};

export const TARGET_DESCRIPTIONS: Record<TargetModel, string> = {
  generic: "Markdown section headings. Works with any model.",
  chatgpt: "Markdown section headings.",
  claude: "XML-style section tags (<goal>, <context>, ...). A formatting convention, not a benchmarked quality gain.",
  gemini: "Markdown section headings.",
};

export function listTaskTypes(args: { task_type?: TaskFamily }) {
  const ids = args.task_type ? [args.task_type] : TASK_ORDER;
  return {
    engine: ENGINE_INFO,
    task_types: ids.map((id) => {
      const bp = BLUEPRINTS[id];
      return {
        id,
        label: bp.label,
        description: bp.description,
        context_fields: bp.fields.map((f) => ({
          field: f.field,
          label: f.label,
          importance: f.importance,
          required: f.required,
          question: f.question,
          why: f.why,
          suggested_answers: f.suggested,
        })),
        method_steps: bp.steps,
        default_output: bp.default_output,
      };
    }),
    modes: (Object.keys(MODE_DESCRIPTIONS) as OptimizeMode[]).map((id) => ({ id, description: MODE_DESCRIPTIONS[id] })),
    target_models: (Object.keys(TARGET_DESCRIPTIONS) as TargetModel[]).map((id) => ({
      id,
      description: TARGET_DESCRIPTIONS[id],
    })),
  };
}

export type ListTaskTypesOutput = ReturnType<typeof listTaskTypes>;

/* ----------------------------------------------------------------- samples */

export { SAMPLES };

/* ------------------------------------------------------------------ helpers */

const RANK = { none: -1, info: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;

export function severityAtLeast(level: keyof typeof RANK, min: keyof typeof RANK): boolean {
  return RANK[level] >= RANK[min];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
