/**
 * Lightweight, self-contained human docs at GET /docs — generated from the
 * OpenAPI document. No JavaScript, no CDN, no third-party requests: the page
 * is served with a CSP that only allows its own inline styles.
 */
import { ENGINE_VERSION, MAX_PROMPT_CHARS } from "@intruva/engine";
import { buildOpenApi } from "./openapi";
import { MAX_BODY_BYTES } from "./validate";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Op = {
  summary: string;
  description?: string;
  operationId: string;
  security?: unknown[];
  requestBody?: { content: { "application/json": { example?: unknown; schema: { $ref: string } } } };
  responses: Record<string, { description: string; content?: { "application/json": { schema?: { $ref?: string } } } }>;
};

export function renderDocs(origin: string): string {
  const spec = buildOpenApi(origin);
  const ops: string[] = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, raw] of Object.entries(methods as Record<string, Op>)) {
      const op = raw as Op;
      const authed = !(Array.isArray(op.security) && op.security.length === 0);
      const body = op.requestBody?.content["application/json"];
      const curl = [
        `curl -sS ${method === "get" ? "" : "-X POST "}${origin}${path}`,
        authed ? `  -H "Authorization: Bearer $INTRUVA_API_KEY"` : "",
        body ? `  -H "Content-Type: application/json"` : "",
        body ? `  -d '${JSON.stringify(body.example).replace(/'/g, "'\\''")}'` : "",
      ]
        .filter(Boolean)
        .join(" \\\n");
      const responses = Object.entries(op.responses)
        .map(([code, r]) => {
          const s = r.content?.["application/json"]?.schema?.$ref?.split("/").pop();
          return `<li><code>${code}</code> ${esc(r.description)}${s ? ` — <a href="#schema-${s}">${s}</a>` : ""}</li>`;
        })
        .join("");
      ops.push(`<section class="op" id="${op.operationId}">
<h3><span class="m ${method}">${method.toUpperCase()}</span> <code>${path}</code>${authed ? "" : ' <span class="tag">no auth</span>'}</h3>
<p>${esc(op.summary)}${op.description ? `. ${esc(op.description)}` : ""}</p>
${body ? `<p>Body: <a href="#schema-${body.schema.$ref.split("/").pop()}">${body.schema.$ref.split("/").pop()}</a></p>` : ""}
<pre><code>${esc(curl)}</code></pre>
<ul class="resp">${responses}</ul>
</section>`);
    }
  }
  const schemaHtml = Object.entries(spec.components.schemas)
    .map(([name, s]) => `<details id="schema-${name}"><summary>${name}</summary><pre><code>${esc(JSON.stringify(s, null, 2))}</code></pre></details>`)
    .join("\n");

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Intruva API docs</title>
<meta name="description" content="Intruva Developer API reference">
<style>
:root{--bg:#fbfbfd;--fg:#1d1d1f;--muted:#5f6368;--card:#fff;--line:#e3e3e8;--code:#f4f4f7;--accent:#3b5bdb}
@media (prefers-color-scheme:dark){:root{--bg:#0f1014;--fg:#ececf1;--muted:#a0a3ad;--card:#16171d;--line:#2a2c35;--code:#1d1f27;--accent:#8ea6ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:880px;margin:0 auto;padding:32px 16px 64px}h1{font-size:28px;margin:0 0 4px}h2{margin-top:40px;font-size:20px;border-bottom:1px solid var(--line);padding-bottom:6px}
h3{font-size:16px;margin:0 0 6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}a{color:var(--accent)}p,li{color:var(--fg)}.muted{color:var(--muted)}
.op{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:14px 0}
.m{font:600 12px ui-monospace,Menlo,monospace;padding:2px 8px;border-radius:6px;color:#fff}.get{background:#2f9e44}.post{background:#3b5bdb}
.tag{font-size:12px;border:1px solid var(--line);border-radius:6px;padding:1px 6px;color:var(--muted)}
pre{background:var(--code);border-radius:8px;padding:12px;overflow-x:auto;font-size:13px}code{font-family:ui-monospace,Menlo,monospace}
details{border:1px solid var(--line);border-radius:8px;padding:6px 12px;margin:8px 0;background:var(--card)}summary{cursor:pointer;font-weight:600}
.note{border-left:3px solid var(--accent);padding:4px 12px;background:var(--card)}ul.resp{padding-left:18px;margin:6px 0 0}
</style></head>
<body><main>
<h1>Intruva Developer API</h1>
<p class="muted">v${spec.info.version} · engine ${ENGINE_VERSION} · <a href="/v1/openapi.json">OpenAPI 3.1 JSON</a></p>
<p class="note"><strong>Rule-based engine.</strong> Analysis, optimization and scanning are deterministic heuristics (pattern matching and weighted rules). No LLM is called, and the same input always returns the same output.</p>
<h2>Authentication</h2>
<p>Send <code>Authorization: Bearer itv_…</code> on every <code>/v1</code> call except <code>/v1/health</code> and <code>/v1/openapi.json</code>. Keys are issued by the Intruva team; the service stores only SHA-256 hashes.</p>
<h2>Limits</h2>
<ul>
<li>Prompt / text: 8–${MAX_PROMPT_CHARS.toLocaleString("en-US")} characters after trimming. Request body: ${MAX_BODY_BYTES / 1024} KB. JSON only.</li>
<li>Rate limit: 60 requests per minute per key (approximate, per Cloudflare location). Exceeding it returns <code>429</code> with <code>Retry-After</code>.</li>
</ul>
<h2>Errors</h2>
<pre><code>{ "error": { "code": "invalid_request", "message": "…", "field": "mode" }, "request_id": "req_…" }</code></pre>
<p>Every response carries an <code>X-Request-Id</code> header; JSON bodies also include <code>request_id</code>.</p>
<h2>Privacy</h2>
<p>Prompt text is processed in memory and never logged or stored. Logs contain only request id, route, status, latency and key label. <code>/v1/security/scan</code> never echoes raw input; findings carry masked evidence only.</p>
<h2>Endpoints</h2>
${ops.join("\n")}
<h2>Schemas</h2>
${schemaHtml}
</main></body></html>`;
}
