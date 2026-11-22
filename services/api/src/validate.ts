/**
 * Request parsing and validation (hand-rolled: zero dependencies, tiny bundle,
 * negligible CPU). Every failure is a 4xx ApiError with a fixed message.
 */
import {
  MAX_PROMPT_CHARS,
  MIN_PROMPT_CHARS,
  TASK_ORDER,
  type AnalyzeRequest,
  type ClarificationAnswer,
  type FeedbackRequest,
  type OptimizeMode,
  type OptimizeRequest,
  type TargetModel,
  type TaskSelection,
} from "@intruva/engine";
import { ApiError, invalid } from "./errors";

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_ANSWERS = 10;
export const MAX_ANSWER_CHARS = 2_000;
export const MAX_NOTE_CHARS = 1_000;

export const TASK_SELECTIONS: readonly TaskSelection[] = ["auto", ...TASK_ORDER];
export const MODES: readonly OptimizeMode[] = ["quick", "deep", "minimal"];
export const TARGET_MODELS: readonly TargetModel[] = ["generic", "chatgpt", "claude", "gemini"];
export const ANSWER_KINDS: readonly ClarificationAnswer["kind"][] = ["answered", "skipped", "assumed"];

/** Read a JSON body with a hard byte cap (works for chunked bodies without Content-Length). */
export async function readJson(req: Request, limit = MAX_BODY_BYTES): Promise<unknown> {
  const ct = req.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(?:;|$)/i.test(ct)) {
    throw new ApiError(415, "unsupported_media_type", "Content-Type must be application/json.");
  }
  const tooLarge = () =>
    new ApiError(413, "payload_too_large", `Request body exceeds ${limit / 1024} KB.`);
  const declared = req.headers.get("content-length");
  if (declared !== null && Number(declared) > limit) throw tooLarge();
  if (!req.body) throw new ApiError(400, "invalid_json", "Request body must be a JSON object.");

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      throw tooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw new ApiError(400, "invalid_json", "Request body is not valid UTF-8.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "Request body is not valid JSON.");
  }
}

/* ----------------------------------------------------------------- helpers */

type Obj = Record<string, unknown>;

function asObject(v: unknown, field = "body"): Obj {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw field === "body"
      ? new ApiError(400, "invalid_request", "Request body must be a JSON object.")
      : invalid(field, `\`${field}\` must be an object.`);
  }
  return v as Obj;
}

function rejectUnknown(o: Obj, allowed: readonly string[], prefix = "") {
  for (const k of Object.keys(o)) {
    if (!allowed.includes(k)) {
      const name = prefix + k;
      throw invalid(name, `Unknown field \`${name.length > 64 ? name.slice(0, 64) + "…" : name}\`. Allowed: ${allowed.join(", ")}.`);
    }
  }
}

function enumField<T extends string>(o: Obj, name: string, values: readonly T[], dflt?: T, prefix = ""): T {
  const v = o[name];
  if (v === undefined && dflt !== undefined) return dflt;
  if (typeof v !== "string" || !(values as readonly string[]).includes(v)) {
    throw invalid(prefix + name, `\`${prefix + name}\` must be one of: ${values.join(", ")}.`);
  }
  return v as T;
}

function optionalString(o: Obj, name: string, max: number, prefix = ""): string | undefined {
  const v = o[name];
  if (v === undefined) return undefined;
  if (typeof v !== "string") throw invalid(prefix + name, `\`${prefix + name}\` must be a string.`);
  if (v.length > max) throw invalid(prefix + name, `\`${prefix + name}\` must be at most ${max} characters.`);
  return v;
}

/** Mirrors the engine's validatePrompt, with API-specific error codes and messages. */
function textField(o: Obj, name: string): string {
  const v = o[name];
  if (v === undefined) throw invalid(name, `\`${name}\` is required.`);
  if (typeof v !== "string") throw invalid(name, `\`${name}\` must be a string.`);
  const t = v.trim();
  if (!t) throw new ApiError(400, "prompt_empty", `\`${name}\` is empty.`, {}, name);
  if (t.length < MIN_PROMPT_CHARS)
    throw new ApiError(400, "prompt_too_short", `\`${name}\` must be at least ${MIN_PROMPT_CHARS} characters.`, {}, name);
  if (t.length > MAX_PROMPT_CHARS)
    throw new ApiError(400, "prompt_too_long", `\`${name}\` must be at most ${MAX_PROMPT_CHARS} characters.`, {}, name);
  return v;
}

/* ---------------------------------------------------------------- schemas */

const ANALYZE_FIELDS = ["prompt", "task_type", "mode", "target_model"] as const;

export function parseAnalyze(body: unknown): AnalyzeRequest {
  const o = asObject(body);
  rejectUnknown(o, ANALYZE_FIELDS);
  return {
    prompt: textField(o, "prompt"),
    task_type: enumField(o, "task_type", TASK_SELECTIONS, "auto"),
    mode: enumField(o, "mode", MODES, "quick"),
    target_model: enumField(o, "target_model", TARGET_MODELS, "generic"),
  };
}

export function parseOptimize(body: unknown): OptimizeRequest {
  const o = asObject(body);
  rejectUnknown(o, [...ANALYZE_FIELDS, "answers"]);
  const base = parseAnalyze(Object.fromEntries(Object.entries(o).filter(([k]) => k !== "answers")));
  const raw = o.answers ?? [];
  if (!Array.isArray(raw)) throw invalid("answers", "`answers` must be an array.");
  if (raw.length > MAX_ANSWERS) throw invalid("answers", `\`answers\` may contain at most ${MAX_ANSWERS} items.`);
  const answers = raw.map((item, i): ClarificationAnswer => {
    const p = `answers[${i}].`;
    const a = asObject(item, `answers[${i}]`);
    rejectUnknown(a, ["field", "kind", "value"], p);
    const field = a.field;
    if (typeof field !== "string" || !/^[a-z0-9_]{1,64}$/.test(field)) {
      throw invalid(p + "field", `\`${p}field\` must be a field id such as "expected_behavior".`);
    }
    const kind = enumField(a, "kind", ANSWER_KINDS, undefined, p);
    const value = optionalString(a, "value", MAX_ANSWER_CHARS, p);
    return value === undefined ? { field, kind } : { field, kind, value };
  });
  return { ...base, answers };
}

export interface ScanRequest {
  text: string;
  redact: boolean;
}

export function parseScan(body: unknown): ScanRequest {
  const o = asObject(body);
  rejectUnknown(o, ["text", "redact"]);
  const text = textField(o, "text");
  const redact = o.redact ?? false;
  if (typeof redact !== "boolean") throw invalid("redact", "`redact` must be a boolean.");
  return { text, redact };
}

export function parseFeedback(body: unknown): FeedbackRequest {
  const o = asObject(body);
  rejectUnknown(o, ["request_id", "rating", "meaning_preserved", "outcome", "note", "consent_benchmark"]);
  const rid = o.request_id;
  if (typeof rid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(rid)) {
    throw invalid("request_id", "`request_id` must be the request_id returned by /v1/analyze or /v1/optimize.");
  }
  const out: FeedbackRequest = {
    request_id: rid,
    rating: enumField(o, "rating", ["up", "down"] as const),
    consent_benchmark: false,
  };
  if (o.meaning_preserved !== undefined)
    out.meaning_preserved = enumField(o, "meaning_preserved", ["yes", "partly", "no"] as const);
  if (o.outcome !== undefined) out.outcome = enumField(o, "outcome", ["better", "same", "worse", "not_used"] as const);
  const note = optionalString(o, "note", MAX_NOTE_CHARS);
  if (note !== undefined) out.note = note;
  if (typeof o.consent_benchmark !== "boolean") {
    throw invalid("consent_benchmark", "`consent_benchmark` is required and must be a boolean.");
  }
  out.consent_benchmark = o.consent_benchmark;
  return out;
}
