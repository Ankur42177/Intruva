/**
 * Intruva Developer API — TypeScript example (fetch, Node 18+).
 *
 *   INTRUVA_API_URL=https://intruva-api.<subdomain>.workers.dev INTRUVA_API_KEY=itv_... \
 *     npx tsx services/api/examples/typescript-client.ts
 *
 * Uses the tiny typed client in ../src/client.ts (also importable as "@intruva/api/client"
 * inside this monorepo). Copy that single file into your project to use it elsewhere.
 */
import { IntruvaApiError, IntruvaClient } from "../src/client";

const intruva = new IntruvaClient({
  baseUrl: process.env.INTRUVA_API_URL ?? "http://127.0.0.1:8787",
  apiKey: process.env.INTRUVA_API_KEY ?? "itv_local_dev_only_DO_NOT_USE_IN_PRODUCTION_000000",
});

const prompt = "Our checkout API got really slow after yesterday's deploy, fix it. Don't change the response format.";

try {
  const health = await intruva.health();
  console.log(`API ${health.api_version}, engine ${health.engine_version} (${health.mode})`);

  // 1. Scan first and redact anything sensitive before analysing.
  const scan = await intruva.scan(prompt, { redact: true });
  console.log(`Risk: ${scan.risk_level}, findings: ${scan.findings.length}`);
  const safePrompt = scan.redacted_text ?? prompt;

  // 2. Diagnose (deep mode returns up to 3 ranked questions).
  const analysis = await intruva.analyze({ prompt: safePrompt, mode: "deep" });
  console.log(`Task: ${analysis.task_type} (${analysis.task_confidence}), overall score ${analysis.scores.overall.toFixed(2)}`);
  for (const q of analysis.questions) console.log(`  ? [${q.field}] ${q.question}`);

  // 3. Optimize: answer the first question, skip the rest (skipped → labelled assumptions).
  const answers = analysis.questions.map((q, i) =>
    i === 0 ? { field: q.field, kind: "answered" as const, value: "p95 under 300 ms" } : { field: q.field, kind: "skipped" as const },
  );
  const result = await intruva.optimize({ prompt: safePrompt, mode: "deep", target_model: "claude", answers });
  console.log(`\n${result.optimized}\n`);
  console.log("Preservation:", result.preservation.map((p) => `${p.id}=${p.status}`).join(", "));
  console.log(`Score ${result.scores_before.overall.toFixed(2)} → ${result.scores_after.overall.toFixed(2)}`);

  // 4. Feedback references the request_id only — never prompt text.
  await intruva.feedback({ request_id: result.request_id, rating: "up", meaning_preserved: "yes", consent_benchmark: false });
} catch (e) {
  if (e instanceof IntruvaApiError) {
    console.error(`Intruva API error ${e.status} ${e.code}: ${e.message} (request_id ${e.requestId})`);
    if (e.retryAfterSeconds) console.error(`Retry after ${e.retryAfterSeconds}s`);
    process.exit(1);
  }
  throw e;
}
