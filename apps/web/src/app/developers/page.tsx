import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Blocks, Bot, KeyRound, Lock, PlugZap, Puzzle, ServerCog, ShieldCheck } from "lucide-react";
import { CodeTabs } from "@/components/developers/CodeTabs";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
  title: "Developers",
  description: "Intruva's REST API, MCP server for any AI client, and Chrome extension, all on one shared prompt-intelligence engine.",
};

// Set NEXT_PUBLIC_INTRUVA_API_PUBLIC_URL at build time once the Worker is deployed.
const API = process.env.NEXT_PUBLIC_INTRUVA_API_PUBLIC_URL || "https://<your-intruva-api>.workers.dev";

const PROMPT = "Our checkout API got slow after the deploy, fix it. Don't change the response format.";

const API_SAMPLES = [
  {
    label: "curl",
    lang: "bash",
    code: `curl -s ${API}/v1/optimize \\
  -H "Authorization: Bearer $INTRUVA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "${PROMPT}",
    "task_type": "auto",
    "mode": "quick",
    "target_model": "generic",
    "answers": []
  }'`,
  },
  {
    label: "TypeScript",
    lang: "ts",
    code: `const res = await fetch("${API}/v1/optimize", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.INTRUVA_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "${PROMPT}",
    task_type: "auto",
    mode: "quick",
    target_model: "generic",
    answers: [],
  }),
});
const result = await res.json();
console.log(result.optimized);
console.log(result.analysis.missing_context.map((m) => m.question));
console.log(result.security_after.risk_level);`,
  },
  {
    label: "Python",
    lang: "python",
    code: `import os, requests

r = requests.post(
    "${API}/v1/optimize",
    headers={"Authorization": f"Bearer {os.environ['INTRUVA_API_KEY']}"},
    json={
        "prompt": "${PROMPT}",
        "task_type": "auto",
        "mode": "quick",
        "target_model": "generic",
        "answers": [],
    },
    timeout=15,
)
r.raise_for_status()
result = r.json()
print(result["optimized"])
print([m["question"] for m in result["analysis"]["missing_context"]])`,
  },
];

const MCP_SAMPLES = [
  {
    label: "Claude Desktop",
    lang: "json",
    code: `// claude_desktop_config.json
{
  "mcpServers": {
    "intruva": {
      "command": "npx",
      "args": ["-y", "intruva-mcp"]
    }
  }
}`,
  },
  {
    label: "Claude Code",
    lang: "bash",
    code: `claude mcp add intruva -- npx -y intruva-mcp`,
  },
  {
    label: "Cursor",
    lang: "json",
    code: `// .cursor/mcp.json
{
  "mcpServers": {
    "intruva": { "command": "npx", "args": ["-y", "intruva-mcp"] }
  }
}`,
  },
  {
    label: "VS Code",
    lang: "json",
    code: `// .vscode/mcp.json
{
  "servers": {
    "intruva": { "type": "stdio", "command": "npx", "args": ["-y", "intruva-mcp"] }
  }
}`,
  },
];

const ENDPOINTS: Array<[string, string, string]> = [
  ["POST", "/v1/analyze", "Diagnosis only: task, intent, ranked missing context and questions, constraints, assumptions, security, scores."],
  ["POST", "/v1/optimize", "Optimized prompt, change notes, intent-preservation checks, before/after scores, labelled assumptions."],
  ["POST", "/v1/security/scan", "Secrets, PII, injection, exfiltration and agent-permission findings, with optional redaction."],
  ["POST", "/v1/feedback", "Rating and outcome signals. Never accepts prompt text."],
  ["GET", "/v1/health", "Service status and engine version. No key needed."],
  ["GET", "/v1/openapi.json", "OpenAPI 3.1 schema for code generation."],
];

export default function DevelopersPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-iris-300/90">Developers</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-fg sm:text-6xl">
          One engine. <span className="font-display italic text-aurora">Every</span> surface.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-soft">
          The diagnosis, optimization and security scan behind the web app are available over REST, as an MCP server
          that works in any MCP-capable AI client, and inside ChatGPT, Claude and Gemini through the Chrome extension.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { href: "#api", icon: <ServerCog className="size-5" />, t: "Developer API", d: "REST on Cloudflare Workers" },
            { href: "#mcp", icon: <PlugZap className="size-5" />, t: "MCP server", d: "Claude, Cursor, VS Code…" },
            { href: "#extension", icon: <Puzzle className="size-5" />, t: "Chrome extension", d: "ChatGPT · Claude · Gemini" },
          ].map((c) => (
            <a key={c.href} href={c.href} className="glass group flex items-center gap-3 rounded-2xl p-4 transition-colors hover:border-white/20">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgb(157_143_255/0.3),rgb(92_225_230/0.2))] text-iris-200 ring-1 ring-white/10">
                {c.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{c.t}</span>
                <span className="block text-xs text-fg-muted">{c.d}</span>
              </span>
              <ArrowRight className="size-4 text-fg-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden />
            </a>
          ))}
        </div>

        <p className="mt-6 flex items-start gap-2 rounded-xl border border-warn/20 bg-warn-soft/50 px-4 py-3 text-sm text-fg-soft">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          <span>
            <strong className="font-medium text-fg">Pilot status:</strong> all surfaces run the same rule-based engine (no AI model yet).
            The MCP server and extension run entirely on your machine. API keys are issued to pilot customers on request.
          </span>
        </p>

        {/* API */}
        <section id="api" className="scroll-mt-24 pt-20">
          <div className="flex items-center gap-2.5">
            <ServerCog className="size-5 text-iris-300" aria-hidden />
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-3xl">Developer API</h2>
          </div>
          <p className="mt-3 max-w-2xl text-fg-soft">
            Same JSON shapes as the engine, versioned under <code className="font-mono text-sm text-fg">/v1</code>. Use it before
            sending prompts to your own model calls, or to gate agent instructions in CI.
          </p>
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
            <div className="glass rounded-2xl p-5">
              <ul className="divide-y divide-white/[0.06]">
                {ENDPOINTS.map(([m, path, d]) => (
                  <li key={path} className="py-3 first:pt-0 last:pb-0">
                    <p className="flex items-center gap-2">
                      <span className={`rounded-md px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold ${m === "GET" ? "bg-aqua-400/12 text-aqua-300" : "bg-iris-500/15 text-iris-200"}`}>{m}</span>
                      <code className="font-mono text-sm text-fg">{path}</code>
                    </p>
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-fg-muted">{d}</p>
                  </li>
                ))}
              </ul>
              <ul className="mt-5 space-y-2 border-t border-white/[0.06] pt-4 text-[0.8125rem] text-fg-soft">
                <li className="flex gap-2"><KeyRound className="mt-0.5 size-4 shrink-0 text-iris-300" aria-hidden /> Bearer API keys. Only hashes are stored server-side.</li>
                <li className="flex gap-2"><Lock className="mt-0.5 size-4 shrink-0 text-iris-300" aria-hidden /> Prompts and findings are never logged or stored.</li>
                <li className="flex gap-2"><Blocks className="mt-0.5 size-4 shrink-0 text-iris-300" aria-hidden /> Per-key rate limits, 64 KB body limit, consistent error objects.</li>
              </ul>
            </div>
            <CodeTabs samples={API_SAMPLES} />
          </div>
        </section>

        {/* MCP */}
        <section id="mcp" className="scroll-mt-24 pt-20">
          <div className="flex items-center gap-2.5">
            <PlugZap className="size-5 text-iris-300" aria-hidden />
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-3xl">MCP server: works with any model</h2>
          </div>
          <p className="mt-3 max-w-2xl text-fg-soft">
            Give your AI assistant a preflight step. Any client that speaks the Model Context Protocol can call Intruva to
            diagnose, optimize and security-scan a prompt before acting on it, whichever model it runs. Runs locally over stdio.
          </p>
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
            <CodeTabs samples={MCP_SAMPLES} />
            <div className="glass rounded-2xl p-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-faint">Tools</p>
              <ul className="mt-3 space-y-3">
                {[
                  ["intruva_analyze_prompt", "Ranked missing context, questions, assumptions, security."],
                  ["intruva_optimize_prompt", "Optimized prompt with preservation checks. Accepts answers for the clarify loop."],
                  ["intruva_scan_prompt", "Security preflight, with optional redaction."],
                  ["intruva_list_task_types", "Task blueprints and the context fields each one checks."],
                ].map(([n, d]) => (
                  <li key={n}>
                    <code className="font-mono text-[0.8125rem] text-aqua-300">{n}</code>
                    <p className="mt-0.5 text-[0.8125rem] text-fg-muted">{d}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 flex gap-2 border-t border-white/[0.06] pt-4 text-[0.8125rem] text-fg-soft">
                <Bot className="mt-0.5 size-4 shrink-0 text-iris-300" aria-hidden />
                Typical agent loop: analyze, ask the user the questions, optimize with the answers, then act.
              </p>
            </div>
          </div>
        </section>

        {/* Extension */}
        <section id="extension" className="scroll-mt-24 pt-20">
          <div className="flex items-center gap-2.5">
            <Puzzle className="size-5 text-iris-300" aria-hidden />
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-3xl">Chrome extension</h2>
          </div>
          <p className="mt-3 max-w-2xl text-fg-soft">
            Optimize right where you write: ChatGPT, Claude and Gemini. It reads the composer only when you click or use
            the shortcut, never sends your message for you, and always lets you revert.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["1. Install", "Pilot build: download the zip from the GitHub release, then load it unpacked at chrome://extensions with Developer mode on."],
              ["2. Write as usual", "Draft your prompt in ChatGPT, Claude or Gemini. The Intruva button appears beside the composer."],
              ["3. Preflight", "Click it or press Alt+Shift+I. Review the gaps and security findings, then replace, copy or revert."],
            ].map(([t, d]) => (
              <div key={t} className="glass rounded-2xl p-5">
                <p className="text-sm font-medium text-fg">{t}</p>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-fg-muted">{d}</p>
              </div>
            ))}
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[0.8125rem] text-fg-soft">
            <li className="flex items-center gap-1.5"><Lock className="size-3.5 text-ok" aria-hidden /> Runs on your device by default</li>
            <li className="flex items-center gap-1.5"><Lock className="size-3.5 text-ok" aria-hidden /> Access only to the three supported sites</li>
            <li className="flex items-center gap-1.5"><Lock className="size-3.5 text-ok" aria-hidden /> No telemetry, no prompt storage</li>
          </ul>
        </section>

        <div className="mt-20">
          <Link href="/workspace/" className="inline-flex items-center gap-2 text-sm font-medium text-aqua-300 hover:text-aqua-400">
            Or try it in the browser workspace <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
