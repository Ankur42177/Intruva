/**
 * Tiny typed client for the Intruva Developer API (fetch-based; works in
 * Node 18+, Deno, Bun, Workers and browsers). Types come from the engine
 * contracts, which are the API schema.
 *
 *   import { IntruvaClient } from "@intruva/api/client";
 *   const intruva = new IntruvaClient({ baseUrl, apiKey: process.env.INTRUVA_API_KEY! });
 *   const analysis = await intruva.analyze({ prompt: "…", mode: "deep" });
 */
import type {
  AnalysisResult,
  AnalyzeRequest,
  FeedbackRequest,
  OptimizeRequest,
  OptimizeResult,
  SecurityReport,
} from "@intruva/engine";

export type AnalyzeInput = Pick<AnalyzeRequest, "prompt"> & Partial<Omit<AnalyzeRequest, "prompt">>;
export type OptimizeInput = AnalyzeInput & Partial<Pick<OptimizeRequest, "answers">>;
export type ScanResult = SecurityReport & { request_id: string; redacted_text?: string; redactions_applied?: number };
export interface Health {
  status: "ok";
  service: string;
  api_version: string;
  engine_version: string;
  mode: "rule-based";
  llm: false;
  request_id: string;
}

export class IntruvaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "IntruvaApiError";
  }
}

export interface IntruvaClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Per-request timeout in ms (default 25 000). */
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export class IntruvaClient {
  private readonly base: string;
  private readonly f: typeof fetch;

  constructor(private readonly opts: IntruvaClientOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, "");
    this.f = opts.fetch ?? fetch;
  }

  health(): Promise<Health> {
    return this.request<Health>("GET", "/v1/health");
  }
  analyze(input: AnalyzeInput): Promise<AnalysisResult> {
    return this.request("POST", "/v1/analyze", input);
  }
  optimize(input: OptimizeInput): Promise<OptimizeResult> {
    return this.request("POST", "/v1/optimize", input);
  }
  scan(text: string, opts: { redact?: boolean } = {}): Promise<ScanResult> {
    return this.request("POST", "/v1/security/scan", { text, redact: opts.redact ?? false });
  }
  feedback(input: FeedbackRequest): Promise<{ request_id: string; accepted: true; stored: boolean }> {
    return this.request("POST", "/v1/feedback", input);
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await this.f(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 25_000),
    });
    const data = (await res.json().catch(() => null)) as
      | (T & { error?: { code: string; message: string }; request_id?: string })
      | null;
    if (!res.ok) {
      const retry = Number(res.headers.get("retry-after"));
      throw new IntruvaApiError(
        res.status,
        data?.error?.code ?? "http_error",
        data?.error?.message ?? `HTTP ${res.status}`,
        data?.request_id ?? res.headers.get("x-request-id") ?? undefined,
        Number.isFinite(retry) && retry > 0 ? retry : undefined,
      );
    }
    return data as T;
  }
}
