/**
 * Thin wrapper around @intruva/engine for the extension: one call that turns
 * composer text + panel choices into an OptimizeResult or a user-facing error.
 */
import {
  ValidationError,
  optimizeLocal,
  type ClarificationAnswer,
  type OptimizeMode,
  type OptimizeRequest,
  type OptimizeResult,
  type TargetModel,
  type TaskSelection,
} from "@intruva/engine";

export interface RunInput {
  text: string;
  mode: OptimizeMode;
  taskType: TaskSelection;
  targetModel: TargetModel;
  answers: ClarificationAnswer[];
}

export type RunOutcome =
  | { ok: true; result: OptimizeResult; engine: "local" | "remote"; notice?: string }
  | { ok: false; code: "empty" | "too_short" | "too_long" | "error"; message: string };

export function toRequest(input: RunInput): OptimizeRequest {
  return {
    prompt: input.text,
    task_type: input.taskType,
    mode: input.mode,
    target_model: input.targetModel,
    answers: input.answers,
  };
}

export function runLocal(input: RunInput): RunOutcome {
  try {
    return { ok: true, result: optimizeLocal(toRequest(input)), engine: "local" };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, code: e.code, message: e.message };
    return { ok: false, code: "error", message: "Intruva couldn't analyse this prompt. Try editing it and run again." };
  }
}
