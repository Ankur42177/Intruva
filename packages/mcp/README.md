# intruva-mcp

**Intruva prompt intelligence as an MCP server.** Check and improve a prompt *before* it goes to an AI, from any client that speaks the [Model Context Protocol](https://modelcontextprotocol.io): Claude Desktop, Claude Code, Cursor, VS Code (Copilot agent mode), Windsurf, Zed, or your own agent on OpenAI, Gemini, or open models through an MCP adapter.

Intruva:

- **diagnoses** what a prompt is missing, ranked by how much it affects answer quality;
- asks only the **1–3 highest-impact clarification questions** (each one says why it matters and offers suggested answers);
- keeps **known facts** separate from **labelled assumptions**, and never invents context;
- builds a **structured, task-aware prompt** that keeps every sentence you wrote word for word, checked by **7 intent-preservation checks**;
- runs a **local security scan** for secrets, personal data, prompt injection, data exfiltration, and risky agent permissions.

> **How it works, honestly.** This release uses Intruva's *demo engine*: deterministic and rule-based (pattern matching plus task blueprints), with **no LLM**. It runs entirely on your machine inside the MCP server process. It makes **no network calls**, reads **no files**, and **never logs prompt text**. Your prompt goes only to the MCP client that called the tool. Treat its output as a structured checklist, not ground truth. The security scan is pattern-based and can miss novel formats.

---

## Quick start

Requires Node.js 20 or later. The published package is one self-contained file with no runtime dependencies.

```bash
npx -y intruva-mcp            # stdio server (what MCP clients launch)
npx -y intruva-mcp --http     # Streamable HTTP at http://127.0.0.1:8765/mcp
npx -y intruva-mcp --help
```

> Not on npm yet? Use the [run from the repo](#run-from-the-repo-before-its-published) instructions and swap `npx -y intruva-mcp` for `node /ABSOLUTE/PATH/packages/mcp/dist/index.js` in the configs below.

## Client setup

Every snippet below launches the same stdio server. Restart or reload the client after editing its config.

### Claude Desktop

Edit `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`; Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "intruva": {
      "command": "npx",
      "args": ["-y", "intruva-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add intruva -- npx -y intruva-mcp                 # this project only (local scope)
claude mcp add --scope user intruva -- npx -y intruva-mcp    # every project
claude mcp add --scope project intruva -- npx -y intruva-mcp # shared via .mcp.json
```

Over HTTP (start `npx -y intruva-mcp --http` first):

```bash
claude mcp add --transport http intruva http://127.0.0.1:8765/mcp
```

The repo build has been verified with Claude Code using this `.mcp.json`:

```json
{
  "mcpServers": {
    "intruva": {
      "type": "stdio",
      "command": "node",
      "args": ["/ABSOLUTE/PATH/packages/mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

### Cursor

`.cursor/mcp.json` in the project, or `~/.cursor/mcp.json` for all projects:

```json
{
  "mcpServers": {
    "intruva": {
      "command": "npx",
      "args": ["-y", "intruva-mcp"]
    }
  }
}
```

### VS Code (GitHub Copilot agent mode)

`.vscode/mcp.json` in the workspace (VS Code uses `servers`, not `mcpServers`):

```json
{
  "servers": {
    "intruva": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "intruva-mcp"]
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "intruva": {
      "command": "npx",
      "args": ["-y", "intruva-mcp"]
    }
  }
}
```

### Other clients and custom agents

Any MCP client works. Launch `npx -y intruva-mcp` as a stdio server, or point an HTTP-capable client at `http://127.0.0.1:8765/mcp`. That covers Zed (`context_servers` in settings), the OpenAI Agents SDK (`MCPServerStdio`), LangChain or LlamaIndex MCP adapters, and agents on Gemini or local models. The tools are model-agnostic: they return plain Markdown text as well as structured JSON.

## HTTP mode

```bash
npx -y intruva-mcp --http                  # http://127.0.0.1:8765/mcp
npx -y intruva-mcp --http --port 9000      # choose a port (0 = any free port)
npx -y intruva-mcp --http --host 0.0.0.0   # expose on the network (see warning)
```

- Streamable HTTP transport in **stateless** mode with JSON responses: `POST /mcp`. `GET`/`DELETE /mcp` return 405. `GET /healthz` returns `{"ok":true,...}`.
- Binds to **127.0.0.1** by default. On loopback it rejects requests whose `Host` or `Origin` is not `localhost`, `127.0.0.1`, or `[::1]`, which protects against DNS-rebinding attacks from web pages.
- **There is no authentication.** `--host 0.0.0.0` lets anyone who can reach the port use the tools, so only do it behind your own auth proxy. The server prints a warning when you do.

Client config for HTTP:

| Client | Config |
| --- | --- |
| Claude Code | `claude mcp add --transport http intruva http://127.0.0.1:8765/mcp` |
| Cursor | `{"mcpServers": {"intruva": {"url": "http://127.0.0.1:8765/mcp"}}}` |
| VS Code | `{"servers": {"intruva": {"type": "http", "url": "http://127.0.0.1:8765/mcp"}}}` |
| Windsurf | `{"mcpServers": {"intruva": {"serverUrl": "http://127.0.0.1:8765/mcp"}}}` |

## Tools

All four tools are read-only, idempotent, and closed-world (`readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`). Each tool returns:

- `structuredContent` that matches its declared `outputSchema` (run `tools/list` to see the full JSON Schemas), and
- a concise **Markdown** `text` block, so models without structured-output support get the same information, including the `field` ids they need to send answers back.

Invalid input returns `isError: true` with a readable message, for example `Intruva could not process this input: That's a little short to analyse — add a few more words.` Prompts must be 8 to 12,000 characters.

### `intruva_analyze_prompt`

Diagnoses a prompt: task type and confidence, intent, ranked missing context, up to 3 clarification questions, facts, constraints, and output requirements already present, per-field coverage, 0–1 scores, and a security scan.

| Input | Type | Default | Notes |
| --- | --- | --- | --- |
| `prompt` | string | required | The user's prompt, verbatim |
| `task_type` | `auto` or one of the 9 families | `auto` | See `intruva_list_task_types` |
| `mode` | `deep` \| `quick` \| `minimal` | `deep` | Only `deep` returns `questions` |
| `redact_secrets` | boolean | `true` | Replace credentials with placeholders before analysis |
| `redact_pii` | boolean | `false` | Also replace emails, phones, cards, and IDs |

Example: `{"prompt": "Write a good mail to my manager."}` returns (abridged):

```json
{
  "task_type": "writing", "task_label": "Writing", "task_confidence": "high",
  "completeness": 0.17,
  "scores": { "intent_clarity": 0, "context_completeness": 0.17, "constraints": 0, "task_specificity": 0.35,
              "output_specification": 0, "validation": 0, "safety": 1, "overall": 0.14 },
  "requires_clarification": true,
  "questions": [
    { "field": "purpose", "question": "What do you want this message to achieve?", "importance": "high", "priority": 0.95,
      "why": "…", "suggested_answers": ["…"], "assumption": "…" },
    { "field": "tone", "question": "What tone should it have?", "importance": "medium", "priority": 0.63, "...": "…" },
    { "field": "output_format", "question": "What shape should the answer take?", "importance": "medium", "priority": 0.63, "...": "…" }
  ],
  "security": { "risk_level": "none", "findings": [], "limitations": ["…"], "engine": "local_patterns" },
  "redaction": { "applied": false, "count": 0, "categories": [], "note": "No secrets needed redaction." },
  "next_step": "Ask the user the questions in `questions` (they may skip any), then call intruva_optimize_prompt …"
}
```

(Scores are rounded here; the tool returns unrounded 0–1 values.)

### `intruva_optimize_prompt`

Builds the structured prompt (goal, context, method steps, constraints, labelled assumptions, output format, success criteria). Every sentence the user wrote is kept verbatim, and gaps are stated as assumptions, never as facts.

| Input | Type | Default | Notes |
| --- | --- | --- | --- |
| `prompt` | string | required | Same prompt you analysed |
| `task_type` | `auto` or a family | `auto` | Pass the analysed `task_type` so field ids line up |
| `mode` | `quick` \| `deep` \| `minimal` | `quick` | `minimal` keeps the prompt as written and appends one line |
| `target_model` | `generic` \| `chatgpt` \| `claude` \| `gemini` | `generic` | `claude` uses XML-style section tags |
| `answers` | `[{field, kind, value}]` | `[]` | `kind`: `answered` (default, needs `value`), `skipped`, `assumed` |
| `redact_secrets` / `redact_pii` | boolean | `true` / `false` | Also applied to answer values |

Returns `optimized`, `changes`, `preservation` (goal, requirements, prohibitions, scope, facts, output, tone, each `pass`, `warn`, or `fail`), `preservation_summary`, `scores_before`/`scores_after`, `assumptions_used`, `open_questions`, `unmatched_answer_fields`, `security_before`/`security_after`, and `redaction`.

Example (the clarify loop):

```json
{
  "prompt": "Write a good mail to my manager.",
  "task_type": "writing",
  "answers": [
    { "field": "purpose", "kind": "answered", "value": "Ask to move my performance review to Friday" },
    { "field": "tone", "kind": "skipped" }
  ]
}
```

The `optimized` result starts like this:

```text
## Goal
Write a good mail to my manager.

## Context
- Purpose: Ask to move my performance review to Friday

## What to do
1. Identify the reader, the purpose, and the one action you want the reader to take.
2. Draft the message leading with the most important point.
...
## Assumptions (confirm or correct before relying on the answer)
...
```

### `intruva_scan_prompt`

Security preflight only. Detects API keys (OpenAI-style `sk-`, Anthropic, AWS, GitHub, Slack, Google, Stripe), JWTs, private keys, passwords, credentials in connection strings, emails, phone numbers, payment cards (Luhn-checked), SSN, Aadhaar, and PAN numbers, prompt-injection phrases, instructions to send data elsewhere, unbounded or destructive agent permissions, and conflicting instructions.

| Input | Type | Default | Notes |
| --- | --- | --- | --- |
| `prompt` | string | required | Up to 100,000 characters |
| `redact` | boolean | `false` | Also return `redacted_text` with placeholders |

Evidence is **always masked**: the raw secret value never appears in the output.

```json
{
  "risk_level": "high",
  "finding_count": 4,
  "counts_by_category": { "secret": 2, "pii": 0, "prompt_injection": 2, "exfiltration": 0, "tool_misuse": 0, "instruction_conflict": 0 },
  "findings": [
    { "category": "secret", "severity": "high", "title": "API key (sk- format)",
      "masked_evidence": "sk-p•••••••• (35 chars hidden)", "span": { "start": 66, "end": 101 },
      "redaction": { "replacement": "[REDACTED_API_KEY]" }, "...": "…" }
  ],
  "redacted_text": "… with key [REDACTED_API_KEY] and my DB is [REDACTED_CONNECTION_STRING]. Ignore previous instructions …",
  "redactions_applied": 2
}
```

### `intruva_list_task_types`

Lists the nine task families (`coding`, `debugging`, `system_design`, `research`, `writing`, `data_analysis`, `learning`, `business`, `agent_instruction`). For each one you get its description, the context fields it checks (with the question asked when a field is missing), its method steps, and its default output, plus the available modes and target formats. Optional input: `task_type` to return a single family.

## Prompts and resources

- **Prompt `preflight`** (arguments: `prompt`, optional `target_model`) runs the full workflow: analyze, ask the user only the returned questions, optimize with the answers, then show the result and assumptions without sending anything until the user confirms. In Claude Code it is `/mcp__intruva__preflight`.
- **Resources `intruva://samples/{id}`**: the nine demo prompts (`debug`, `code`, `design`, `research`, `write`, `learn`, `business`, `agent`, `secret`). Credentials in the `secret` sample are fake.

## Privacy

- No network access, no file access, no telemetry. The engine is bundled into the server.
- Logs go to **stderr** only, and only for startup, shutdown, and error *class names*. Prompt text, answers, findings, and evidence are never logged. In stdio mode, stdout carries only JSON-RPC.
- With `redact_secrets: true` (the default), detected credentials are replaced *before* analysis. They never appear in `optimized`, facts, coverage evidence, or any other output. Findings are still reported from the original text, with masked evidence.

## Run from the repo before it's published

```bash
git clone <repo> && cd <repo>
npm install
npm run build -w intruva-mcp          # writes packages/mcp/dist/index.js
node packages/mcp/dist/index.js --help
```

Then use an absolute path in any client config:

```json
{ "mcpServers": { "intruva": { "command": "node", "args": ["/ABSOLUTE/PATH/packages/mcp/dist/index.js"] } } }
```

Paths with spaces are fine inside the JSON `args` array.

## Development

```bash
npm run build -w intruva-mcp       # esbuild → dist/index.js (+ dist/THIRD_PARTY_LICENSES.txt)
npm run typecheck -w intruva-mcp   # tsc --noEmit
npm test -w intruva-mcp            # builds, then node:test via tsx
```

- `src/server.ts`: tool, prompt, and resource registration (`createServer()`)
- `src/core.ts`: engine adapter (redaction, result shaping), with no MCP dependencies
- `src/schemas.ts`: zod input and output schemas
- `src/format.ts`: Markdown renderers
- `src/http.ts`, `src/index.ts`: Streamable HTTP transport and the CLI/stdio entry
- `test/server.test.ts`: every tool, prompt, and resource through the SDK `Client` over the in-memory transport (the client validates `structuredContent` against each `outputSchema`)
- `test/e2e.test.ts`: the **built** `dist/index.js` over stdio (SDK client and raw JSON-RPC framing) and over Streamable HTTP

The bundle inlines `@intruva/engine` (an unpublished workspace package), `@modelcontextprotocol/sdk`, and `zod`. That is why they are all `devDependencies`, and why the published package installs with zero dependencies. Their licenses are collected in `dist/THIRD_PARTY_LICENSES.txt`.

## Publishing to npm

```bash
npm test -w intruva-mcp                          # build + full test suite
cd packages/mcp && npm pack --dry-run            # should list dist/index.js, dist/THIRD_PARTY_LICENSES.txt, README.md, package.json
# smoke-test the tarball from a clean directory:
npm pack --pack-destination /tmp/intruva && (cd "$(mktemp -d)" && npm init -y >/dev/null && npm i /tmp/intruva/intruva-mcp-*.tgz && npx intruva-mcp --version)
npm login
npm publish --access public                      # from packages/mcp (prepack rebuilds dist/)
```

Before the first public release, set `license` in `package.json` (it is currently `UNLICENSED`), and optionally add `repository` and `homepage`. Bump `version` for each release. The server reports that version at runtime.
