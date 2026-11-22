/**
 * Local preview engine — analysis (plan §6 pipeline steps 1–8).
 *
 * Deterministic heuristics that produce schema-valid AnalysisResult objects so
 * the full UI can be designed and tested before the FastAPI engine exists.
 * The remote engine will replace classification/extraction with LLM-assisted
 * steps; the shapes stay the same.
 */
import type {
  AnalysisResult,
  AnalyzeRequest,
  Assumption,
  ClarificationAnswer,
  CoverageItem,
  Importance,
  KnownFact,
  MissingContext,
  ScoreDimension,
  Scores,
  SecurityReport,
  TaskFamily,
} from "../contracts";
import { scanPrompt } from "../security/scan";
import { BLUEPRINTS, RX, TASK_ORDER, type Blueprint, type FieldSpec } from "./taxonomy";

export const MAX_PROMPT_CHARS = 12_000;
export const MIN_PROMPT_CHARS = 8;

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: "empty" | "too_short" | "too_long",
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validatePrompt(prompt: string): void {
  const t = prompt.trim();
  if (!t) throw new ValidationError("Add a prompt to analyse.", "empty");
  if (t.length < MIN_PROMPT_CHARS)
    throw new ValidationError("That's a little short to analyse — add a few more words.", "too_short");
  if (t.length > MAX_PROMPT_CHARS)
    throw new ValidationError(
      `Prompts are limited to ${MAX_PROMPT_CHARS.toLocaleString("en-US")} characters in this preview.`,
      "too_long",
    );
}

/* ------------------------------------------------------------ classification */

export interface Classification {
  family: TaskFamily;
  confidence: Importance;
  reason: string;
  matched: string[];
}

export function classify(prompt: string): Classification {
  const scores = new Map<TaskFamily, { score: number; hits: Set<string> }>();
  for (const fam of TASK_ORDER) {
    const bp = BLUEPRINTS[fam];
    let score = 0;
    const hits = new Set<string>();
    for (const [rx, w] of bp.signals) {
      for (const m of prompt.matchAll(rx)) {
        score += w;
        hits.add(m[0].toLowerCase());
      }
    }
    scores.set(fam, { score, hits });
  }
  // Debugging beats coding when explicit failure words are present.
  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  const [topFam, top] = ranked[0];
  const second = ranked[1][1].score;

  if (top.score === 0) {
    return {
      family: RX.codeGoal.test(prompt) ? "coding" : "writing",
      confidence: "low",
      reason: "No strong task signals, so this is a best guess. Pick a task type if it looks wrong.",
      matched: [],
    };
  }
  const margin = top.score - second;
  const confidence: Importance = margin >= 4 ? "high" : margin >= 2 ? "medium" : "low";
  const matched = [...top.hits].slice(0, 4);
  return {
    family: topFam,
    confidence,
    reason: `Matched ${matched.map((m) => `“${m}”`).join(", ")}.`,
    matched,
  };
}

/* ---------------------------------------------------------------- extraction */

export function splitSentences(prompt: string): string[] {
  const withoutCode = prompt.replace(/```[\s\S]*?```/g, " ");
  return withoutCode
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replace(/^[-*•]\s*/, ""))
    .filter((s) => s.length > 2);
}

export function extractCodeBlocks(prompt: string): string[] {
  return [...prompt.matchAll(/```[\s\S]*?```/g)].map((m) => m[0]);
}

const FACT_RX =
  /\b(?:we (?:use|have|are|run)|our|i (?:am|have|use|work)|i'?m|currently|using|it (?:is|was|uses)|version|v\d|\d+(?:\.\d+)?\s*(?:%|ms|s|gb|mb|users|rps|k|m)\b)/i;

export function extractParts(prompt: string) {
  const sentences = splitSentences(prompt);
  const constraints: string[] = [];
  const output: string[] = [];
  const facts: KnownFact[] = [];
  const other: string[] = [];
  sentences.forEach((s, i) => {
    if (i > 0 && RX.constraints.test(s)) constraints.push(s);
    else if (i > 0 && RX.output.test(s)) output.push(s);
    else if (i > 0 && (FACT_RX.test(s) || RX.stack.test(s))) facts.push({ text: s, source: "prompt" });
    else if (i > 0) other.push(s);
  });
  // The first sentence is the goal; but a lone constraint-ish first sentence still counts.
  const goal = sentences[0] ?? prompt.trim();
  if (sentences.length === 1 && RX.constraints.test(goal)) constraints.push(goal);
  return { goal, constraints, output, facts, other, code: extractCodeBlocks(prompt) };
}

function intentSummary(goal: string, bp: Blueprint): string {
  const clean = goal.replace(/\s+/g, " ").trim();
  const clipped = clean.length > 140 ? clean.slice(0, 137).trimEnd() + "…" : clean;
  return `${bp.description.replace(/\.$/, "")} — “${clipped}”`;
}

/* ------------------------------------------------------------------ coverage */

function answerFor(answers: ClarificationAnswer[], field: string) {
  return answers.find((a) => a.field === field);
}

export function computeCoverage(prompt: string, bp: Blueprint, answers: ClarificationAnswer[] = []): CoverageItem[] {
  return bp.fields.map((spec) => {
    const a = answerFor(answers, spec.field);
    const m = spec.detect.exec(prompt);
    let covered: CoverageItem["covered"] = m ? "yes" : "no";
    let evidence = m ? excerpt(prompt, m.index, m[0].length) : undefined;
    if (a?.kind === "answered" && a.value) {
      covered = "yes";
      evidence = `Your answer: ${a.value}`;
    } else if (!m && (a?.kind === "assumed" || a?.kind === "skipped")) {
      covered = "partial";
      evidence = "Labelled assumption";
    }
    return { field: spec.field, label: spec.label, weight: spec.weight, required: spec.required, covered, evidence };
  });
}

export function completenessOf(coverage: CoverageItem[]): number {
  const total = coverage.reduce((s, c) => s + c.weight, 0);
  const got = coverage.reduce((s, c) => s + c.weight * (c.covered === "yes" ? 1 : c.covered === "partial" ? 0.5 : 0), 0);
  return total ? got / total : 0;
}

function excerpt(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + len + 24);
  return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ").trim() + (end < text.length ? "…" : "");
}

/* ----------------------------------------------------------- missing context */

const IMPACT: Record<Importance, number> = { high: 1, medium: 0.66, low: 0.33 };

export function missingContext(bp: Blueprint, coverage: CoverageItem[]): MissingContext[] {
  return bp.fields
    .map((spec): MissingContext | null => {
      const c = coverage.find((x) => x.field === spec.field)!;
      if (c.covered === "yes") return null;
      const uncertainty = c.covered === "partial" ? 0.5 : 1;
      // plan §7: priority = impact × uncertainty × answerability / effort
      const priority = (IMPACT[spec.importance] * uncertainty * spec.answerability) / spec.effort;
      return {
        field: spec.field,
        label: spec.label,
        importance: spec.importance,
        question: spec.question,
        why: spec.why,
        suggested_answers: spec.suggested,
        assumption: spec.assumption,
        priority: Math.round(priority * 100) / 100,
      };
    })
    .filter((x): x is MissingContext => x !== null)
    .sort((a, b) => b.priority - a.priority);
}

export function selectQuestions(missing: MissingContext[]): MissingContext[] {
  const worth = missing.filter((m) => m.importance !== "low" && m.priority >= 0.25);
  return worth.slice(0, 3);
}

/* -------------------------------------------------------------------- scoring */

export const SCORE_WEIGHTS: Record<ScoreDimension, number> = {
  intent_clarity: 0.2,
  context_completeness: 0.2,
  constraints: 0.15,
  task_specificity: 0.15,
  output_specification: 0.15,
  validation: 0.1,
  safety: 0.05,
};

export const SCORE_LABELS: Record<ScoreDimension, { label: string; hint: string }> = {
  intent_clarity: { label: "Intent clarity", hint: "Does the prompt clearly state the goal?" },
  context_completeness: { label: "Context", hint: "Is there enough task context — facts, inputs, environment?" },
  constraints: { label: "Constraints", hint: "Are limits and must-not-do items clear?" },
  task_specificity: { label: "Task specificity", hint: "Are the action steps clear?" },
  output_specification: { label: "Output spec", hint: "Does it define the expected response?" },
  validation: { label: "Success criteria", hint: "Can completion be checked?" },
  safety: { label: "Safety & privacy", hint: "Are obvious secrets, PII, or risky instructions absent?" },
};

const VAGUE_RX = /\b(?:this|that|it|stuff|things?|something|better|cleaner|good|nice|properly|whatever|etc)\b/gi;

function dimFromFields(coverage: CoverageItem[], bp: Blueprint, dim: ScoreDimension): number | null {
  const specs = bp.fields.filter((s) => s.dimension === dim);
  if (!specs.length) return null;
  const vals = specs.map((s): number => {
    const c = coverage.find((x) => x.field === s.field)!;
    return c.covered === "yes" ? 1 : c.covered === "partial" ? 0.5 : 0;
  });
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function safetyScore(sec: SecurityReport): number {
  const map = { none: 1, info: 0.9, low: 0.8, medium: 0.55, high: 0.25, critical: 0.05 } as const;
  return map[sec.risk_level];
}

export function computeScores(prompt: string, bp: Blueprint, coverage: CoverageItem[], sec: SecurityReport): Scores {
  const words = prompt.trim().split(/\s+/).filter(Boolean).length;
  const vague = (prompt.match(VAGUE_RX) ?? []).length;
  const hasArtifact = RX.artifact.test(prompt);
  const vaguePenalty = hasArtifact ? 0 : Math.min(0.3, (vague / Math.max(words, 1)) * 1.5);

  const fromFields = (d: ScoreDimension, fallback: number) => dimFromFields(coverage, bp, d) ?? fallback;

  const intentBase = Math.min(1, 0.25 + Math.min(words, 40) / 80);
  const intent = clamp(0.5 * intentBase + 0.5 * fromFields("intent_clarity", intentBase) - vaguePenalty);

  const constraintsCount = (prompt.match(new RegExp(RX.constraints, "gi")) ?? []).length;
  const constraints = clamp(0.5 * Math.min(1, constraintsCount * 0.4) + 0.5 * fromFields("constraints", Math.min(1, constraintsCount * 0.4)));

  const verbs = (prompt.match(/\b(?:list|explain|compare|fix|find|write|draft|design|analy[sz]e|summari[sz]e|implement|identify|recommend|propose|outline|evaluate)\b/gi) ?? []).length;
  const taskSpec = clamp(0.15 + Math.min(0.45, verbs * 0.15) + 0.4 * fromFields("task_specificity", Math.min(1, words / 60)));

  const outputDetected = RX.output.test(prompt) ? 1 : 0;
  const output = clamp(0.6 * outputDetected + 0.4 * fromFields("output_specification", outputDetected));

  const successDetected = RX.success.test(prompt) ? 1 : 0;
  const validation = clamp(0.5 * successDetected + 0.5 * fromFields("validation", successDetected));

  const s: Omit<Scores, "overall"> = {
    intent_clarity: intent,
    context_completeness: completenessOf(coverage),
    constraints,
    task_specificity: taskSpec,
    output_specification: output,
    validation,
    safety: safetyScore(sec),
  };
  return { ...s, overall: weighted(s) };
}

export function weighted(s: Omit<Scores, "overall">): number {
  return (Object.keys(SCORE_WEIGHTS) as ScoreDimension[]).reduce((sum, k) => sum + s[k] * SCORE_WEIGHTS[k], 0);
}

function clamp(n: number) {
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

/* ------------------------------------------------------------------- analyse */

let seq = 0;
export function requestId(): string {
  seq += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `req_local_${Date.now().toString(36)}${seq}${rand}`;
}

export function analyzeLocal(req: AnalyzeRequest, answers: ClarificationAnswer[] = []): AnalysisResult {
  validatePrompt(req.prompt);
  const prompt = req.prompt;
  const security = scanPrompt(prompt);
  const cls =
    req.task_type === "auto"
      ? classify(prompt)
      : { family: req.task_type, confidence: "high" as Importance, reason: "Selected by you.", matched: [] };
  const bp = BLUEPRINTS[cls.family];
  const parts = extractParts(prompt);
  const coverage = computeCoverage(prompt, bp, answers);
  const missing = missingContext(bp, coverage);
  const questions = req.mode === "deep" ? selectQuestions(missing) : [];

  const answerFacts: KnownFact[] = answers
    .filter((a) => a.kind === "answered" && a.value)
    .map((a) => ({ text: `${labelFor(bp, a.field)}: ${a.value}`, source: "answer" }));

  const assumptions: Assumption[] = missing.map((m) => ({
    field: m.field,
    text: m.assumption,
    basis: `“${m.label}” wasn't specified.`,
  }));

  return {
    request_id: requestId(),
    task_type: cls.family,
    task_confidence: cls.confidence,
    task_reason: cls.reason,
    intent: intentSummary(parts.goal, bp),
    known_facts: [...parts.facts, ...answerFacts],
    constraints: parts.constraints,
    output_requirements: parts.output,
    assumptions,
    missing_context: missing,
    coverage,
    completeness: completenessOf(coverage),
    security,
    scores: computeScores(prompt, bp, coverage, security),
    requires_clarification: questions.length > 0,
    questions,
  };
}

export function labelFor(bp: Blueprint, field: string): string {
  return bp.fields.find((f: FieldSpec) => f.field === field)?.label ?? field;
}
