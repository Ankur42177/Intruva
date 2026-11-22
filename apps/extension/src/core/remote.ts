/**
 * Optional remote analysis (off by default). Runs in the background service
 * worker so the API key never touches the page. Detected secrets and personal
 * data are always redacted on-device before anything is sent.
 */
import { applyRedactions, scanPrompt, type OptimizeRequest, type OptimizeResult } from "@intruva/engine";
import type { Settings } from "./settings";

export const REMOTE_TIMEOUT_MS = 25_000;

export function redactForRemote(text: string): { text: string; redacted: number } {
  const findings = scanPrompt(text).findings.filter(
    (f) => f.redaction && (f.category === "secret" || f.category === "pii"),
  );
  return { text: applyRedactions(text, findings), redacted: findings.length };
}

function looksLikeResult(v: unknown): v is OptimizeResult {
  const r = v as OptimizeResult;
  return (
    !!r &&
    typeof r.optimized === "string" &&
    !!r.analysis &&
    Array.isArray(r.analysis.missing_context) &&
    !!r.security_after &&
    Array.isArray(r.preservation)
  );
}

export async function callRemoteOptimize(
  settings: Settings,
  request: OptimizeRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<{ result: OptimizeResult; redacted: number }> {
  const { text, redacted } = redactForRemote(request.prompt);
  const url = `${settings.remote.apiUrl.replace(/\/+$/, "")}/v1/optimize`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.remote.apiKey}` },
      body: JSON.stringify({ ...request, prompt: text }),
      signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    throw new Error("Couldn't reach the Intruva API.");
  }
  if (!res.ok) throw new Error(`The Intruva API returned an error (${res.status}).`);
  const body: unknown = await res.json().catch(() => null);
  if (!looksLikeResult(body)) throw new Error("The Intruva API returned an unexpected response.");
  return { result: body, redacted };
}
