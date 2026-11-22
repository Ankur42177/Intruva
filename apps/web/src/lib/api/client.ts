/**
 * Intruva client — the single seam between the UI and the engine.
 *
 *  - "demo"   (default): rule-based preview engine running in the browser.
 *                        Nothing leaves the device. Clearly labelled in the UI.
 *  - "remote": FastAPI service at NEXT_PUBLIC_INTRUVA_API_URL (plan §14).
 *
 * The UI only talks to this module, so wiring the backend is a config change.
 * Progress is honest (plan §29.3): no artificial delays. The demo engine is
 * synchronous and fast, so results appear immediately; remote calls report
 * the stage they're actually in.
 */
import type {
  AnalysisResult,
  AnalyzeRequest,
  OptimizeRequest,
  OptimizeResult,
  ProgressCallback,
  SecurityReport,
} from "../contracts";
import { analyzeLocal, validatePrompt } from "../engine/analyze";
import { optimizeLocal } from "../engine/optimize";
import { scanPrompt } from "../security/scan";

export type Engine = "demo" | "remote";

const API_URL = process.env.NEXT_PUBLIC_INTRUVA_API_URL?.replace(/\/$/, "") || "";
const TIMEOUT_MS = 25_000;

export const configuredEngine: Engine = API_URL ? "remote" : "demo";
export const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL || "";

/** The API could not be reached or failed — the UI offers retry / demo fallback. */
export class BackendUnavailableError extends Error {
  constructor(message = "The Intruva API is unavailable right now.") {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: combined,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new BackendUnavailableError(
      timeout.aborted ? "The Intruva API took too long to respond." : "Couldn't reach the Intruva API.",
    );
  }
  if (res.status >= 500) throw new BackendUnavailableError(`The Intruva API returned an error (${res.status}).`);
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(typeof detail?.detail === "string" ? detail.detail : `Request failed (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

/** Yield one frame so the "pressed/loading" state paints before synchronous work. */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export const intruva = {
  engine: configuredEngine,

  /** Always on-device: live editor highlights and pre-send redaction. */
  scanLocal(text: string): SecurityReport {
    return scanPrompt(text);
  },

  async analyze(
    req: AnalyzeRequest,
    opts: { engine?: Engine; onProgress?: ProgressCallback; signal?: AbortSignal } = {},
  ): Promise<AnalysisResult> {
    validatePrompt(req.prompt);
    const engine = opts.engine ?? configuredEngine;
    if (engine === "remote") {
      opts.onProgress?.("diagnose");
      return post<AnalysisResult>("/v1/analyze", req, opts.signal);
    }
    await nextFrame();
    return analyzeLocal(req);
  },

  async optimize(
    req: OptimizeRequest,
    opts: { engine?: Engine; prior?: AnalysisResult; onProgress?: ProgressCallback; signal?: AbortSignal } = {},
  ): Promise<OptimizeResult> {
    validatePrompt(req.prompt);
    const engine = opts.engine ?? configuredEngine;
    if (engine === "remote") {
      opts.onProgress?.("optimize");
      return post<OptimizeResult>("/v1/optimize", req, opts.signal);
    }
    await nextFrame();
    return optimizeLocal(req, opts.prior);
  },
};
