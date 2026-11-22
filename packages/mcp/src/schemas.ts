/**
 * Zod schemas for tool inputs and structured outputs.
 *
 * Output schemas mirror `@intruva/engine` contracts exactly (MCP clients may
 * validate `structuredContent` strictly, and zod objects serialise with
 * `additionalProperties: false`), so every key we return must be declared here.
 */
import * as z from "zod";

/* ------------------------------------------------------------------ enums */

export const TASK_FAMILIES = [
  "coding",
  "debugging",
  "system_design",
  "research",
  "writing",
  "data_analysis",
  "learning",
  "business",
  "agent_instruction",
] as const;

export const taskFamily = z.enum(TASK_FAMILIES);
export const taskSelection = z.enum(["auto", ...TASK_FAMILIES]);
export const mode = z.enum(["quick", "deep", "minimal"]);
export const targetModel = z.enum(["generic", "chatgpt", "claude", "gemini"]);
export const importance = z.enum(["high", "medium", "low"]);
export const severity = z.enum(["info", "low", "medium", "high", "critical"]);
export const riskLevel = z.enum(["none", "info", "low", "medium", "high", "critical"]);
export const findingCategory = z.enum([
  "secret",
  "pii",
  "prompt_injection",
  "exfiltration",
  "tool_misuse",
  "instruction_conflict",
]);

/* ------------------------------------------------------------ shared shapes */

/** 0–1 ratio. Not range-checked: weighted sums can drift by float epsilon. */
const unit = z.number();

export const scores = z.object({
  intent_clarity: unit,
  context_completeness: unit,
  constraints: unit,
  task_specificity: unit,
  output_specification: unit,
  validation: unit,
  safety: unit,
  overall: unit,
});

export const finding = z.object({
  id: z.string(),
  category: findingCategory,
  severity,
  title: z.string(),
  explanation: z.string(),
  recommendation: z.string(),
  confidence: importance,
  span: z.object({ start: z.number().int(), end: z.number().int() }),
  masked_evidence: z.string().describe("Masked excerpt. Never contains the raw secret value."),
  redaction: z.object({ replacement: z.string() }).optional(),
});

export const securityReport = z.object({
  risk_level: riskLevel,
  findings: z.array(finding),
  limitations: z.array(z.string()),
  engine: z.enum(["local_patterns", "remote_layered"]),
});

export const missingContext = z.object({
  field: z.string(),
  label: z.string(),
  importance,
  question: z.string(),
  why: z.string(),
  suggested_answers: z.array(z.string()),
  assumption: z.string(),
  priority: z.number(),
});

export const assumption = z.object({ field: z.string(), text: z.string(), basis: z.string() });

export const coverageItem = z.object({
  field: z.string(),
  label: z.string(),
  weight: z.number(),
  required: z.boolean(),
  covered: z.enum(["yes", "partial", "no"]),
  evidence: z.string().optional(),
});

export const engineInfo = z.object({
  name: z.literal("intruva-local"),
  version: z.string(),
  kind: z.literal("rule-based").describe("Deterministic, pattern-based engine. No LLM, no network."),
});

export const redactionInfo = z.object({
  applied: z.boolean(),
  count: z.number().int(),
  categories: z.array(findingCategory),
  note: z.string(),
});

/* ------------------------------------------------------------------ inputs */

const promptInput = z
  .string()
  .describe("The full prompt text exactly as the user wrote it (8 to 12,000 characters). Do not paraphrase it.");

const redactSecretsInput = z
  .boolean()
  .default(true)
  .describe(
    "Replace detected credentials (API keys, tokens, private keys, connection-string passwords) with placeholders such as [REDACTED_API_KEY] before analysis, so they never appear in the output. Findings are still reported from the original text. Default true.",
  );

const redactPiiInput = z
  .boolean()
  .default(false)
  .describe("Also replace detected personal data (emails, phone numbers, card numbers, national IDs) with placeholders. Default false.");

export const analyzeInput = {
  prompt: promptInput,
  task_type: taskSelection
    .default("auto")
    .describe("Task family. Leave as \"auto\" to classify automatically; set it if you already know the kind of task."),
  mode: mode
    .default("deep")
    .describe("\"deep\" (default) also returns up to 3 ranked clarification questions. \"quick\" and \"minimal\" return the diagnosis only."),
  redact_secrets: redactSecretsInput,
  redact_pii: redactPiiInput,
};

export const answerInput = z.object({
  field: z
    .string()
    .min(1)
    .describe("The `field` id of the question being answered, exactly as returned by intruva_analyze_prompt (e.g. \"purpose\", \"expected_behavior\")."),
  kind: z
    .enum(["answered", "skipped", "assumed"])
    .default("answered")
    .describe("\"answered\" with a value; \"skipped\" or \"assumed\" to accept the labelled assumption instead."),
  value: z.string().max(2000).optional().describe("The user's answer, in their own words. Required when kind is \"answered\"."),
});

export const optimizeInput = {
  prompt: promptInput,
  task_type: taskSelection
    .default("auto")
    .describe("Task family. Use the same value analysis reported (or \"auto\") so answer field ids line up."),
  mode: mode
    .default("quick")
    .describe(
      "\"quick\" (default): full structured prompt. \"deep\": same, but also lists low-importance assumptions. \"minimal\": keeps the prompt as written and appends only a one-line output format and an ask to state assumptions.",
    ),
  target_model: targetModel
    .default("generic")
    .describe("Formatting target. \"claude\" uses XML-style section tags; the others use Markdown headings."),
  answers: z
    .array(answerInput)
    .max(20)
    .default([])
    .describe(
      "Answers to the clarification questions from intruva_analyze_prompt. Only include what the user actually said; never invent answers. Unanswered gaps become labelled assumptions in the optimized prompt.",
    ),
  redact_secrets: redactSecretsInput,
  redact_pii: redactPiiInput,
};

export const scanInput = {
  prompt: z
    .string()
    .describe("The text to scan: a prompt, or content about to be pasted into one (up to 100,000 characters)."),
  redact: z
    .boolean()
    .default(false)
    .describe("Also return `redacted_text`: the input with every redactable finding (secrets and personal data) replaced by a placeholder."),
};

export const listTaskTypesInput = {
  task_type: taskFamily.optional().describe("Return only this task family. Omit to list all nine."),
};

/* ----------------------------------------------------------------- outputs */

export const analyzeOutput = {
  engine: engineInfo,
  request_id: z.string(),
  task_type: taskFamily,
  task_label: z.string(),
  task_confidence: importance,
  task_reason: z.string(),
  intent: z.string(),
  completeness: unit.describe("Weighted share of this task family's context fields that the prompt covers."),
  scores,
  requires_clarification: z.boolean(),
  questions: z
    .array(missingContext)
    .describe("0 to 3 highest-impact questions to ask the user (deep mode only). Answer them via intruva_optimize_prompt `answers`."),
  missing_context: z.array(missingContext).describe("Every missing context field, ranked by priority (highest first)."),
  known_facts: z.array(z.object({ text: z.string(), source: z.enum(["prompt", "answer"]) })),
  constraints: z.array(z.string()),
  output_requirements: z.array(z.string()),
  assumptions: z.array(assumption).describe("Labelled assumptions that would be used if the gaps are not filled."),
  coverage: z.array(coverageItem),
  security: securityReport.describe("Scan of the ORIGINAL prompt. Spans refer to the original text."),
  redaction: redactionInfo,
  next_step: z.string(),
};

export const optimizeOutput = {
  engine: engineInfo,
  request_id: z.string(),
  optimized: z.string().describe("The optimized prompt, ready to send to the target AI after the user reviews it."),
  task_type: taskFamily,
  task_label: z.string(),
  task_confidence: importance,
  mode,
  target_model: targetModel,
  changes: z.array(
    z.object({
      kind: z.enum([
        "clarified_goal",
        "added_context",
        "added_constraints",
        "specified_output",
        "added_validation",
        "added_structure",
        "labeled_assumptions",
        "model_format",
      ]),
      title: z.string(),
      detail: z.string(),
    }),
  ),
  preservation: z.array(
    z.object({
      id: z.enum(["goal", "requirements", "prohibitions", "scope", "facts", "output", "tone"]),
      label: z.string(),
      status: z.enum(["pass", "warn", "fail"]),
      detail: z.string(),
    }),
  ),
  preservation_summary: z.object({ pass: z.number().int(), warn: z.number().int(), fail: z.number().int() }),
  scores_before: scores,
  scores_after: scores,
  assumptions_used: z.array(assumption).describe("Gaps filled with labelled assumptions (stated openly in the prompt, never as facts)."),
  open_questions: z.array(missingContext).describe("High-impact questions still unanswered (deep mode). Ask the user and re-run if they matter."),
  unmatched_answer_fields: z
    .array(z.string())
    .describe(
      "Answer field ids that match no question for this task family (check task_type). Answered values were still added to the Context section as given.",
    ),
  security_before: securityReport.describe("Scan of the original prompt."),
  security_after: securityReport.describe("Scan of the optimized prompt."),
  redaction: redactionInfo,
};

export const scanOutput = {
  engine: engineInfo,
  risk_level: riskLevel,
  finding_count: z.number().int(),
  counts_by_category: z.object({
    secret: z.number().int(),
    pii: z.number().int(),
    prompt_injection: z.number().int(),
    exfiltration: z.number().int(),
    tool_misuse: z.number().int(),
    instruction_conflict: z.number().int(),
  }),
  findings: z.array(finding),
  limitations: z.array(z.string()),
  redacted_text: z.string().optional().describe("Present when `redact` was true."),
  redactions_applied: z.number().int().optional(),
};

export const listTaskTypesOutput = {
  engine: engineInfo,
  task_types: z.array(
    z.object({
      id: taskFamily,
      label: z.string(),
      description: z.string(),
      context_fields: z.array(
        z.object({
          field: z.string(),
          label: z.string(),
          importance,
          required: z.boolean(),
          question: z.string(),
          why: z.string(),
          suggested_answers: z.array(z.string()),
        }),
      ),
      method_steps: z.array(z.string()),
      default_output: z.array(z.string()),
    }),
  ),
  modes: z.array(z.object({ id: mode, description: z.string() })),
  target_models: z.array(z.object({ id: targetModel, description: z.string() })),
};
