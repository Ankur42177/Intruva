/**
 * Intruva API contracts (v1).
 *
 * These types mirror the REST contract in the product plan (§5.C3, §14) and use
 * snake_case so they map 1:1 onto the FastAPI/Pydantic models that will live in
 * `services/api`. When the backend lands, move these into `packages/schemas`
 * (JSON Schema / OpenAPI as the source of truth) and generate this file.
 */

export type TaskFamily =
  | "coding"
  | "debugging"
  | "system_design"
  | "research"
  | "writing"
  | "data_analysis"
  | "learning"
  | "business"
  | "agent_instruction";

export type TaskSelection = "auto" | TaskFamily;

export type OptimizeMode = "quick" | "deep" | "minimal";

export type TargetModel = "generic" | "chatgpt" | "claude" | "gemini";

export type Importance = "high" | "medium" | "low";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type ScoreDimension =
  | "intent_clarity"
  | "context_completeness"
  | "constraints"
  | "task_specificity"
  | "output_specification"
  | "validation"
  | "safety";

export type Scores = Record<ScoreDimension, number> & { overall: number };

/* ----------------------------------------------------------------- context */

export interface KnownFact {
  text: string;
  /** Where the fact came from. Never "inferred": inferred items are assumptions. */
  source: "prompt" | "answer";
}

export interface Assumption {
  field: string;
  text: string;
  /** Why we assumed this rather than asking. */
  basis: string;
}

export interface CoverageItem {
  field: string;
  label: string;
  weight: number;
  required: boolean;
  covered: "yes" | "partial" | "no";
  /** Short excerpt from the prompt that satisfied the field (never secrets). */
  evidence?: string;
}

export interface MissingContext {
  field: string;
  label: string;
  importance: Importance;
  question: string;
  /** Why this matters for answer quality — shown next to every question. */
  why: string;
  suggested_answers: string[];
  /** The labelled assumption used if the user skips the question. */
  assumption: string;
  /** Heuristic ranking value; see plan §7 question_priority. */
  priority: number;
}

/* ---------------------------------------------------------------- security */

export type FindingCategory =
  | "secret"
  | "pii"
  | "prompt_injection"
  | "exfiltration"
  | "tool_misuse"
  | "instruction_conflict";

export interface SecurityFinding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  title: string;
  explanation: string;
  recommendation: string;
  confidence: "high" | "medium" | "low";
  /** Character span in the analysed text. */
  span: { start: number; end: number };
  /** Masked excerpt — safe to render and log. Never the raw secret. */
  masked_evidence: string;
  /** Present when the finding can be redacted in place. */
  redaction?: { replacement: string };
}

export interface SecurityReport {
  risk_level: Severity | "none";
  findings: SecurityFinding[];
  limitations: string[];
  engine: "local_patterns" | "remote_layered";
}

/* --------------------------------------------------------------- analysis */

export interface AnalyzeRequest {
  prompt: string;
  task_type: TaskSelection;
  mode: OptimizeMode;
  target_model: TargetModel;
}

export interface AnalysisResult {
  request_id: string;
  task_type: TaskFamily;
  task_confidence: Importance;
  task_reason: string;
  intent: string;
  known_facts: KnownFact[];
  constraints: string[];
  output_requirements: string[];
  assumptions: Assumption[];
  missing_context: MissingContext[];
  coverage: CoverageItem[];
  completeness: number;
  security: SecurityReport;
  scores: Scores;
  requires_clarification: boolean;
  /** Ranked, 0–3 questions. Only populated in deep mode. */
  questions: MissingContext[];
}

/* ----------------------------------------------------------- clarification */

export type AnswerKind = "answered" | "skipped" | "assumed";

export interface ClarificationAnswer {
  field: string;
  kind: AnswerKind;
  value?: string;
}

/* ---------------------------------------------------------------- optimize */

export interface OptimizeRequest extends AnalyzeRequest {
  answers: ClarificationAnswer[];
}

export type ChangeKind =
  | "clarified_goal"
  | "added_context"
  | "added_constraints"
  | "specified_output"
  | "added_validation"
  | "added_structure"
  | "labeled_assumptions"
  | "model_format";

export interface ChangeNote {
  kind: ChangeKind;
  title: string;
  detail: string;
}

export interface PreservationCheck {
  id: "goal" | "requirements" | "prohibitions" | "scope" | "facts" | "output" | "tone";
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface OptimizeResult {
  request_id: string;
  original: string;
  optimized: string;
  analysis: AnalysisResult;
  changes: ChangeNote[];
  preservation: PreservationCheck[];
  scores_before: Scores;
  scores_after: Scores;
  security_after: SecurityReport;
  assumptions_used: Assumption[];
}

/* ---------------------------------------------------------------- feedback */

export interface FeedbackRequest {
  request_id: string;
  rating: "up" | "down";
  meaning_preserved?: "yes" | "partly" | "no";
  outcome?: "better" | "same" | "worse" | "not_used";
  note?: string;
  /** Raw prompt text is never part of feedback. */
  consent_benchmark: boolean;
}

/* ---------------------------------------------------------------- progress */

export type PipelineStage = "scan" | "classify" | "diagnose" | "optimize" | "verify";

export type ProgressCallback = (stage: PipelineStage) => void;
