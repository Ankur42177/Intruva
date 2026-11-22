/**
 * OpenAPI 3.1 description of the Intruva v1 API.
 *
 * The component schemas mirror `@intruva/engine/contracts` field-for-field.
 * Response schemas set `additionalProperties: false`, and the test suite
 * validates real engine output against them across every sample, mode and
 * target model — so if the contract types change, the tests fail until this
 * file is updated.
 */
import { ENGINE_VERSION, MAX_PROMPT_CHARS, MIN_PROMPT_CHARS, TASK_ORDER } from "@intruva/engine";
import { MAX_ANSWER_CHARS, MAX_ANSWERS, MAX_BODY_BYTES, MAX_NOTE_CHARS } from "./validate";

export const API_VERSION = "1.0.0";

type Schema = Record<string, unknown>;
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const str = (extra: Schema = {}): Schema => ({ type: "string", ...extra });
const num01: Schema = { type: "number", minimum: 0, maximum: 1 };
const arr = (items: Schema, extra: Schema = {}): Schema => ({ type: "array", items, ...extra });
const obj = (properties: Record<string, Schema>, required: string[], extra: Schema = {}): Schema => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
  ...extra,
});
const enm = (values: readonly string[], description?: string): Schema => ({
  type: "string",
  enum: [...values],
  ...(description ? { description } : {}),
});

const SCORE_DIMENSIONS = [
  "intent_clarity",
  "context_completeness",
  "constraints",
  "task_specificity",
  "output_specification",
  "validation",
  "safety",
] as const;

const requestIdSchema = str({ pattern: "^req_[0-9a-f]{24}$", description: "Unique per API request; also sent as the X-Request-Id header." });
const promptSchema = str({
  minLength: 1,
  maxLength: MAX_PROMPT_CHARS + 1000,
  description: `The prompt to analyse. After trimming it must be ${MIN_PROMPT_CHARS}–${MAX_PROMPT_CHARS.toLocaleString("en-US")} characters.`,
});

const schemas: Record<string, Schema> = {
  TaskFamily: enm(TASK_ORDER),
  TaskSelection: enm(["auto", ...TASK_ORDER], "`auto` lets the engine classify the task."),
  OptimizeMode: enm(["quick", "deep", "minimal"], "`deep` also returns up to 3 ranked clarification questions."),
  TargetModel: enm(["generic", "chatgpt", "claude", "gemini"]),
  Importance: enm(["high", "medium", "low"]),
  Severity: enm(["info", "low", "medium", "high", "critical"]),
  Scores: obj(
    Object.fromEntries([...SCORE_DIMENSIONS, "overall"].map((d) => [d, num01])),
    [...SCORE_DIMENSIONS, "overall"],
    { description: "Heuristic 0–1 scores per dimension; `overall` is the weighted sum." },
  ),
  KnownFact: obj({ text: str(), source: enm(["prompt", "answer"]) }, ["text", "source"]),
  Assumption: obj({ field: str(), text: str(), basis: str({ description: "Why this was assumed rather than asked." }) }, [
    "field",
    "text",
    "basis",
  ]),
  CoverageItem: obj(
    {
      field: str(),
      label: str(),
      weight: { type: "number" },
      required: { type: "boolean" },
      covered: enm(["yes", "partial", "no"]),
      evidence: str({ description: "Short excerpt that satisfied the field (never secrets)." }),
    },
    ["field", "label", "weight", "required", "covered"],
  ),
  MissingContext: obj(
    {
      field: str(),
      label: str(),
      importance: ref("Importance"),
      question: str(),
      why: str(),
      suggested_answers: arr(str()),
      assumption: str({ description: "The labelled assumption used if the question is skipped." }),
      priority: { type: "number", minimum: 0 },
    },
    ["field", "label", "importance", "question", "why", "suggested_answers", "assumption", "priority"],
  ),
  SecurityFinding: obj(
    {
      id: str(),
      category: enm(["secret", "pii", "prompt_injection", "exfiltration", "tool_misuse", "instruction_conflict"]),
      severity: ref("Severity"),
      title: str(),
      explanation: str(),
      recommendation: str(),
      confidence: enm(["high", "medium", "low"]),
      span: obj({ start: { type: "integer", minimum: 0 }, end: { type: "integer", minimum: 0 } }, ["start", "end"], {
        description: "UTF-16 code-unit offsets into the analysed text.",
      }),
      masked_evidence: str({ description: "Masked excerpt — safe to render and log. Never the raw secret." }),
      redaction: obj({ replacement: str() }, ["replacement"]),
    },
    ["id", "category", "severity", "title", "explanation", "recommendation", "confidence", "span", "masked_evidence"],
  ),
  SecurityReport: obj(
    {
      risk_level: enm(["none", "info", "low", "medium", "high", "critical"]),
      findings: arr(ref("SecurityFinding")),
      limitations: arr(str()),
      engine: enm(["local_patterns", "remote_layered"]),
    },
    ["risk_level", "findings", "limitations", "engine"],
  ),
  AnalyzeRequest: obj(
    {
      prompt: promptSchema,
      task_type: { ...ref("TaskSelection"), default: "auto" },
      mode: { ...ref("OptimizeMode"), default: "quick" },
      target_model: { ...ref("TargetModel"), default: "generic" },
    },
    ["prompt"],
  ),
  ClarificationAnswer: obj(
    {
      field: str({ pattern: "^[a-z0-9_]{1,64}$", description: "A `field` from missing_context / questions." }),
      kind: enm(["answered", "skipped", "assumed"]),
      value: str({ maxLength: MAX_ANSWER_CHARS }),
    },
    ["field", "kind"],
  ),
  OptimizeRequest: obj(
    {
      prompt: promptSchema,
      task_type: { ...ref("TaskSelection"), default: "auto" },
      mode: { ...ref("OptimizeMode"), default: "quick" },
      target_model: { ...ref("TargetModel"), default: "generic" },
      answers: { ...arr(ref("ClarificationAnswer"), { maxItems: MAX_ANSWERS }), default: [] },
    },
    ["prompt"],
  ),
  AnalysisResult: obj(
    {
      request_id: requestIdSchema,
      task_type: ref("TaskFamily"),
      task_confidence: ref("Importance"),
      task_reason: str(),
      intent: str(),
      known_facts: arr(ref("KnownFact")),
      constraints: arr(str()),
      output_requirements: arr(str()),
      assumptions: arr(ref("Assumption")),
      missing_context: arr(ref("MissingContext")),
      coverage: arr(ref("CoverageItem")),
      completeness: num01,
      security: ref("SecurityReport"),
      scores: ref("Scores"),
      requires_clarification: { type: "boolean" },
      questions: arr(ref("MissingContext"), { maxItems: 3, description: "Ranked, 0–3 questions. Only populated in deep mode." }),
    },
    [
      "request_id",
      "task_type",
      "task_confidence",
      "task_reason",
      "intent",
      "known_facts",
      "constraints",
      "output_requirements",
      "assumptions",
      "missing_context",
      "coverage",
      "completeness",
      "security",
      "scores",
      "requires_clarification",
      "questions",
    ],
  ),
  ChangeNote: obj(
    {
      kind: enm([
        "clarified_goal",
        "added_context",
        "added_constraints",
        "specified_output",
        "added_validation",
        "added_structure",
        "labeled_assumptions",
        "model_format",
      ]),
      title: str(),
      detail: str(),
    },
    ["kind", "title", "detail"],
  ),
  PreservationCheck: obj(
    {
      id: enm(["goal", "requirements", "prohibitions", "scope", "facts", "output", "tone"]),
      label: str(),
      status: enm(["pass", "warn", "fail"]),
      detail: str(),
    },
    ["id", "label", "status", "detail"],
  ),
  OptimizeResult: obj(
    {
      request_id: requestIdSchema,
      original: str(),
      optimized: str({ description: "Structured prompt. Every sentence of the original is kept verbatim." }),
      analysis: ref("AnalysisResult"),
      changes: arr(ref("ChangeNote")),
      preservation: arr(ref("PreservationCheck")),
      scores_before: ref("Scores"),
      scores_after: ref("Scores"),
      security_after: ref("SecurityReport"),
      assumptions_used: arr(ref("Assumption")),
    },
    [
      "request_id",
      "original",
      "optimized",
      "analysis",
      "changes",
      "preservation",
      "scores_before",
      "scores_after",
      "security_after",
      "assumptions_used",
    ],
  ),
  ScanRequest: obj(
    {
      text: promptSchema,
      redact: { type: "boolean", default: false, description: "Return `redacted_text` with every redactable finding replaced." },
    },
    ["text"],
  ),
  ScanResult: obj(
    {
      request_id: requestIdSchema,
      risk_level: enm(["none", "info", "low", "medium", "high", "critical"]),
      findings: arr(ref("SecurityFinding")),
      limitations: arr(str()),
      engine: enm(["local_patterns", "remote_layered"]),
      redacted_text: str({ description: "Present only when `redact: true`." }),
      redactions_applied: { type: "integer", minimum: 0, description: "Present only when `redact: true`." },
    },
    ["request_id", "risk_level", "findings", "limitations", "engine"],
  ),
  FeedbackRequest: obj(
    {
      request_id: str({ pattern: "^[A-Za-z0-9_-]{1,128}$" }),
      rating: enm(["up", "down"]),
      meaning_preserved: enm(["yes", "partly", "no"]),
      outcome: enm(["better", "same", "worse", "not_used"]),
      note: str({ maxLength: MAX_NOTE_CHARS, description: "Optional free text. Do not paste prompt text here." }),
      consent_benchmark: { type: "boolean" },
    },
    ["request_id", "rating", "consent_benchmark"],
    { description: "Raw prompt text is never part of feedback; unknown fields are rejected." },
  ),
  FeedbackAccepted: obj(
    {
      request_id: requestIdSchema,
      accepted: { type: "boolean", const: true },
      stored: { type: "boolean", const: false, description: "Pilot: feedback is validated and acknowledged but not persisted." },
    },
    ["request_id", "accepted", "stored"],
  ),
  Health: obj(
    {
      status: { type: "string", const: "ok" },
      service: { type: "string", const: "intruva-api" },
      api_version: str(),
      engine_version: str(),
      mode: { type: "string", const: "rule-based", description: "The engine is deterministic and rule-based; no LLM is called." },
      llm: { type: "boolean", const: false },
      request_id: requestIdSchema,
    },
    ["status", "service", "api_version", "engine_version", "mode", "llm", "request_id"],
  ),
  Error: obj(
    {
      error: obj(
        {
          code: enm([
            "not_found",
            "method_not_allowed",
            "missing_api_key",
            "invalid_api_key",
            "invalid_authorization",
            "forbidden_origin",
            "rate_limited",
            "unsupported_media_type",
            "payload_too_large",
            "invalid_json",
            "invalid_request",
            "prompt_empty",
            "prompt_too_short",
            "prompt_too_long",
            "internal_error",
          ]),
          message: str(),
          field: str({ description: "The request field the error refers to, when applicable." }),
        },
        ["code", "message"],
      ),
      request_id: requestIdSchema,
    },
    ["error", "request_id"],
  ),
};

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ref("Error") } },
});
const jsonBody = (schemaName: string, example: unknown) => ({
  required: true,
  content: { "application/json": { schema: ref(schemaName), example } },
});
const ok = (schemaName: string, description = "OK") => ({
  description,
  content: { "application/json": { schema: ref(schemaName) } },
});
const AUTHED_ERRORS = {
  "400": errorResponse("Invalid JSON or request fields (`invalid_json`, `invalid_request`, `prompt_*`)."),
  "401": errorResponse("Missing or invalid API key."),
  "413": errorResponse(`Body larger than ${MAX_BODY_BYTES / 1024} KB.`),
  "415": errorResponse("Content-Type is not application/json."),
  "429": {
    ...errorResponse("Rate limit exceeded. See the Retry-After header."),
    headers: { "Retry-After": { schema: { type: "integer" }, description: "Seconds to wait." } },
  },
  "500": errorResponse("Unexpected engine error (sanitized)."),
};

const EXAMPLE_PROMPT = "Our checkout API got really slow after yesterday's deploy, fix it. Don't change the response format.";

export function buildOpenApi(serverUrl?: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Intruva Developer API",
      version: API_VERSION,
      summary: "Prompt intelligence: diagnose missing context, optimize without losing intent, scan for risk.",
      description: [
        `Engine \`@intruva/engine\` v${ENGINE_VERSION}. **The engine is deterministic and rule-based — no LLM is called.**`,
        "Results are heuristics (pattern matching and weighted rules), and identical input gives identical output.",
        "",
        "Privacy: prompt text is processed in memory only. It is never logged or stored by the API.",
        "Analyze/optimize responses echo parts of your prompt back to you (facts, constraints, the optimized prompt);",
        "use `/v1/security/scan` with `redact: true` first if your prompt may contain secrets.",
      ].join("\n"),
      license: { name: "Proprietary" },
    },
    servers: [{ url: serverUrl ?? "https://intruva-api.<your-subdomain>.workers.dev" }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "meta", description: "Health and API description." },
      { name: "prompt", description: "Analysis and optimization." },
      { name: "security", description: "Secret / PII / injection scanning." },
      { name: "feedback", description: "Pilot feedback (never prompt text)." },
    ],
    paths: {
      "/v1/health": {
        get: {
          tags: ["meta"],
          operationId: "health",
          summary: "Service health and engine version",
          security: [],
          responses: { "200": ok("Health") },
        },
      },
      "/v1/openapi.json": {
        get: {
          tags: ["meta"],
          operationId: "openapi",
          summary: "This OpenAPI 3.1 document",
          security: [],
          responses: { "200": { description: "OpenAPI document", content: { "application/json": {} } } },
        },
      },
      "/v1/analyze": {
        post: {
          tags: ["prompt"],
          operationId: "analyze",
          summary: "Diagnose a prompt",
          description:
            "Classifies the task, separates known facts from labelled assumptions, ranks missing context, scores seven quality dimensions, and runs the security scan. In `deep` mode it also returns up to 3 clarification questions.",
          requestBody: jsonBody("AnalyzeRequest", { prompt: EXAMPLE_PROMPT, task_type: "auto", mode: "deep", target_model: "generic" }),
          responses: { "200": ok("AnalysisResult"), ...AUTHED_ERRORS },
        },
      },
      "/v1/optimize": {
        post: {
          tags: ["prompt"],
          operationId: "optimize",
          summary: "Build a structured, task-aware prompt that keeps every original sentence",
          description:
            "Runs analysis (applying any clarification `answers`), builds the optimized prompt, and verifies intent preservation (goal, requirements, prohibitions, scope, facts, output, tone).",
          requestBody: jsonBody("OptimizeRequest", {
            prompt: EXAMPLE_PROMPT,
            mode: "deep",
            answers: [{ field: "expected_behavior", kind: "answered", value: "p95 under 300 ms" }],
          }),
          responses: { "200": ok("OptimizeResult"), ...AUTHED_ERRORS },
        },
      },
      "/v1/security/scan": {
        post: {
          tags: ["security"],
          operationId: "securityScan",
          summary: "Scan text for secrets, PII, prompt injection, exfiltration and risky agent permissions",
          description:
            "Findings carry masked evidence only. With `redact: true` the response includes `redacted_text`. The raw input is never echoed back.",
          requestBody: jsonBody("ScanRequest", { text: "Use key sk-ant-REPLACE_ME_0000000000000 and email jane@acme-corp.io", redact: true }),
          responses: { "200": ok("ScanResult"), ...AUTHED_ERRORS },
        },
      },
      "/v1/feedback": {
        post: {
          tags: ["feedback"],
          operationId: "feedback",
          summary: "Send a rating for a previous result (no prompt text)",
          description: "Pilot behaviour: validated and acknowledged with 202, not stored.",
          requestBody: jsonBody("FeedbackRequest", {
            request_id: "req_0123456789abcdef01234567",
            rating: "up",
            meaning_preserved: "yes",
            outcome: "better",
            consent_benchmark: false,
          }),
          responses: { "202": ok("FeedbackAccepted", "Accepted (not stored during the pilot)"), ...AUTHED_ERRORS },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "itv_<43 base64url chars>" },
      },
      schemas,
    },
  };
}
