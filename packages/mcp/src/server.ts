/**
 * The Intruva MCP server: tools, prompts, and resources over `@intruva/engine`.
 * Transport-agnostic — see `index.ts` (stdio) and `http.ts` (Streamable HTTP).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { ValidationError } from "@intruva/engine";
import * as z from "zod";
import { analyze, InputError, listTaskTypes, optimize, SAMPLES, scan } from "./core";
import { formatAnalysis, formatOptimize, formatScan, formatTaskTypes } from "./format";
import { log } from "./log";
import {
  analyzeInput,
  analyzeOutput,
  listTaskTypesInput,
  listTaskTypesOutput,
  optimizeInput,
  optimizeOutput,
  scanInput,
  scanOutput,
} from "./schemas";
import { VERSION } from "./version";

export const SERVER_NAME = "intruva";

const INSTRUCTIONS = `Intruva is a prompt-intelligence preflight. Use it BEFORE a user's prompt is sent to an AI model or agent, or when the user asks to improve, check, or secure a prompt.

Typical flow:
1. intruva_analyze_prompt (mode "deep") — diagnose what's missing and get 0-3 high-impact clarification questions plus a security scan.
2. Ask the user those questions (they may skip any). Never invent answers on the user's behalf.
3. intruva_optimize_prompt with the same prompt and the user's replies as \`answers\` — returns a structured prompt that keeps every sentence the user wrote, labels unfilled gaps as assumptions, and reports intent-preservation checks.
4. Show the optimized prompt and its assumptions to the user before using it.
Use intruva_scan_prompt alone for a quick secrets / PII / prompt-injection check (e.g. before pasting logs or documents).

The engine is deterministic and rule-based (no LLM), runs entirely locally, and makes no network calls. Treat its output as a structured checklist, not ground truth.`;

const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

/** Run a tool body and shape the result; map known errors to friendly `isError` results. */
function respond<T extends Record<string, unknown>>(tool: string, body: () => T, format: (r: T) => string): CallToolResult {
  try {
    const result = body();
    return { content: [{ type: "text", text: format(result) }], structuredContent: result };
  } catch (err) {
    if (err instanceof ValidationError || err instanceof InputError) {
      return { isError: true, content: [{ type: "text", text: `Intruva could not process this input: ${err.message}` }] };
    }
    // Never log inputs or messages that could echo them; the error class is enough to debug.
    log(`internal error in ${tool}: ${err instanceof Error ? err.name : typeof err}`);
    return {
      isError: true,
      content: [{ type: "text", text: "Intruva hit an internal error while processing this input. Please report it." }],
    };
  }
}

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      title: "Intruva Prompt Intelligence",
      version: VERSION,
      description: "Diagnose, clarify, optimize, and security-scan prompts locally before sending them to any AI.",
    },
    { instructions: INSTRUCTIONS },
  );

  /* ----------------------------------------------------------------- tools */

  server.registerTool(
    "intruva_analyze_prompt",
    {
      title: "Analyze prompt",
      description: `Diagnose a prompt BEFORE it is sent to an AI model or agent: what kind of task it is, what the user wants, and which context is missing, ranked by impact on answer quality.

Returns: task type + confidence, intent summary, ranked missing context, up to 3 clarification questions (mode "deep", the default) each with a \`field\` id, why it matters, suggested answers and the labelled assumption used if skipped; known facts, constraints and output requirements found in the prompt; coverage per context field; 0-1 scores (intent clarity, context, constraints, task specificity, output spec, success criteria, safety, overall); and a local security scan (secrets, PII, prompt injection, data exfiltration, risky agent permissions) with masked evidence only.

Use when the user asks to improve, review, or check a prompt, or before delegating a vague request to another model. Then ask the user the returned questions and call intruva_optimize_prompt with their answers. Pass the user's prompt verbatim. Deterministic rule-based engine (no LLM); runs locally, no network.`,
      inputSchema: analyzeInput,
      outputSchema: analyzeOutput,
      annotations: { title: "Analyze prompt", ...READ_ONLY },
    },
    async (args) => respond("intruva_analyze_prompt", () => analyze(args), formatAnalysis),
  );

  server.registerTool(
    "intruva_optimize_prompt",
    {
      title: "Optimize prompt",
      description: `Rewrite a prompt into a structured, task-aware version (goal, context, method steps, constraints, labelled assumptions, output format, success criteria) while keeping every sentence the user wrote word for word. Never invents facts: gaps the user didn't fill are stated as explicit assumptions.

Returns: the optimized prompt, change notes, 7 intent-preservation checks (goal, requirements, prohibitions, scope, facts, output, tone — each pass/warn/fail, verified by string comparison), before/after scores, the assumptions used, any still-open high-impact questions, and security scans of the original and optimized text. Detected secrets are replaced with placeholders by default (redact_secrets) so they don't flow into the new prompt.

For best results first call intruva_analyze_prompt, ask the user its questions, and pass their replies in \`answers\` ({field, kind: "answered", value} or {field, kind: "skipped"}). Only pass what the user actually said. Show the result to the user before sending it to another AI. Rule-based engine (no LLM); runs locally, no network.`,
      inputSchema: optimizeInput,
      outputSchema: optimizeOutput,
      annotations: { title: "Optimize prompt", ...READ_ONLY },
    },
    async (args) => respond("intruva_optimize_prompt", () => optimize(args), formatOptimize),
  );

  server.registerTool(
    "intruva_scan_prompt",
    {
      title: "Scan prompt for security risks",
      description: `Security preflight for text about to be sent to an AI or agent: detects secrets (API keys for OpenAI/Anthropic/AWS/GitHub/Slack/Google/Stripe, JWTs, private keys, passwords, credentials in connection strings), personal data (emails, phone numbers, payment cards, SSN/Aadhaar/PAN), prompt-injection phrases, instructions to send data elsewhere, unbounded or destructive agent permissions, and conflicting instructions.

Returns: overall risk level, findings with severity, explanation, recommendation, character span and MASKED evidence (raw secret values are never returned), counts by category, and the scanner's limitations. Set \`redact: true\` to also get the text with secrets and personal data replaced by placeholders such as [REDACTED_API_KEY].

Use before pasting logs, code, documents, or emails into a prompt, or when the user asks whether a prompt is safe to share. Pattern-based and local: it can miss novel formats, and a clean result is not a guarantee.`,
      inputSchema: scanInput,
      outputSchema: scanOutput,
      annotations: { title: "Scan prompt for security risks", ...READ_ONLY },
    },
    async (args) => respond("intruva_scan_prompt", () => scan(args), formatScan),
  );

  server.registerTool(
    "intruva_list_task_types",
    {
      title: "List task types",
      description:
        "List the nine task families Intruva recognises (coding, debugging, system_design, research, writing, data_analysis, learning, business, agent_instruction) with a description, the context fields each one checks (with the question asked when a field is missing), its method steps and default output, plus the available optimize modes and target-model formats. Use it to pick an explicit task_type or to understand which `field` ids exist.",
      inputSchema: listTaskTypesInput,
      outputSchema: listTaskTypesOutput,
      annotations: { title: "List task types", ...READ_ONLY },
    },
    async (args) => respond("intruva_list_task_types", () => listTaskTypes(args), formatTaskTypes),
  );

  /* --------------------------------------------------------------- prompts */

  server.registerPrompt(
    "preflight",
    {
      title: "Preflight a prompt",
      description:
        "Check and improve a prompt before sending it to an AI: analyze it, ask only the high-impact questions, optimize with your answers, and review the result and any security findings.",
      argsSchema: {
        prompt: z.string().describe("The prompt you are about to send to an AI."),
        target_model: z
          .string()
          .optional()
          .describe("Optional: generic, chatgpt, claude, or gemini (formatting of the optimized prompt)."),
      },
    },
    ({ prompt, target_model }) => {
      const target = ["generic", "chatgpt", "claude", "gemini"].includes(target_model ?? "") ? target_model : "generic";
      return {
        description: "Intruva preflight workflow",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Run an Intruva preflight on the prompt below before it is sent to an AI. Follow these steps:

1. Call \`intruva_analyze_prompt\` with the prompt exactly as written and mode "deep".
2. If the security risk is high or critical, tell me what was found (masked evidence only) and recommend removing or redacting it before continuing.
3. If questions come back, ask me ONLY those questions (at most 3), one short list, showing the suggested answers. Tell me I can skip any. Do not answer them yourself.
4. Call \`intruva_optimize_prompt\` with the same prompt, target_model "${target}", and my replies as \`answers\` (use each question's \`field\` id; kind "answered" with my words, or kind "skipped").
5. Show me the optimized prompt in a code block, the labelled assumptions I should confirm, and any intent-preservation check that is not "pass". Do not send it anywhere until I confirm.

Prompt:
<prompt>
${prompt}
</prompt>`,
            },
          },
        ],
      };
    },
  );

  /* ------------------------------------------------------------- resources */

  for (const s of SAMPLES) {
    const uri = `intruva://samples/${s.id}`;
    server.registerResource(
      `sample-${s.id}`,
      uri,
      {
        title: `Sample prompt: ${s.label}`,
        description: `${s.pitch} (expected task type: ${s.family}). Any credentials in samples are fake.`,
        mimeType: "text/plain",
      },
      async () => ({ contents: [{ uri, mimeType: "text/plain", text: s.prompt }] }),
    );
  }

  return server;
}
