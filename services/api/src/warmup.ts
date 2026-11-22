/**
 * Engine warm-up at module (global) scope.
 *
 * The engine's first execution in a fresh isolate pays one-off costs (regex
 * compilation, lazy bytecode compilation) of roughly 5–10 ms CPU — about the
 * whole Workers Free per-request budget (10 ms). Global-scope work counts
 * toward the separate 1 s startup limit instead, so we run each engine path
 * once here on a short fixed sample. Pure computation: no I/O, no timers, no
 * crypto randomness (all disallowed in global scope).
 */
import { analyzeLocal, optimizeLocal, SAMPLES, scanPrompt } from "@intruva/engine";

export let warmedUp = false;

try {
  for (const s of SAMPLES.slice(0, 3)) {
    scanPrompt(s.prompt);
    analyzeLocal({ prompt: s.prompt, task_type: "auto", mode: "deep", target_model: "generic" });
    optimizeLocal({ prompt: s.prompt, task_type: "auto", mode: "deep", target_model: "claude", answers: [] });
  }
  warmedUp = true;
} catch {
  // Never block startup; the first request just pays the cold cost.
}
