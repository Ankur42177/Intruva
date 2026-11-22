/**
 * @intruva/engine — the one engine behind every Intruva surface
 * (web app, developer API, Chrome extension, MCP server). Plan §6, §23.
 */
export * from "./contracts";
export {
  analyzeLocal,
  classify,
  validatePrompt,
  ValidationError,
  MAX_PROMPT_CHARS,
  MIN_PROMPT_CHARS,
  SCORE_LABELS,
  SCORE_WEIGHTS,
  type Classification,
} from "./engine/analyze";
export { optimizeLocal } from "./engine/optimize";
export { BLUEPRINTS, TASK_ORDER, type Blueprint, type FieldSpec } from "./engine/taxonomy";
export { scanPrompt, applyRedactions, severityRank, SCAN_LIMITATIONS } from "./security/scan";
export { SAMPLES, sampleById, type Sample } from "./samples";

export const ENGINE_VERSION = "0.1.0";
