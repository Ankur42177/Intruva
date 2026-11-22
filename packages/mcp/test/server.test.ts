/**
 * In-process tests: real SDK Client <-> Intruva McpServer over the SDK's
 * in-memory transport. The Client validates every structuredContent against
 * the tool's declared outputSchema, so schema drift fails here.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SAMPLES } from "@intruva/engine";
import { call, connectInMemory, everything, RAW_SECRETS, structured, textOf } from "./helpers";

const TOOLS = ["intruva_analyze_prompt", "intruva_optimize_prompt", "intruva_scan_prompt", "intruva_list_task_types"];
const secretSample = SAMPLES.find((s) => s.id === "secret")!.prompt;

let client: Client;
let close: () => Promise<void>;

before(async () => {
  ({ client, close } = await connectInMemory());
});
after(async () => {
  await close();
});

describe("server metadata", () => {
  it("advertises name, version and usage instructions", () => {
    assert.equal(client.getServerVersion()?.name, "intruva");
    assert.match(client.getInstructions() ?? "", /intruva_analyze_prompt/);
    assert.match(client.getInstructions() ?? "", /rule-based/);
  });

  it("lists the four tools with input/output schemas and read-only annotations", async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [...TOOLS].sort());
    for (const t of tools) {
      assert.ok(t.description && t.description.length > 80, `${t.name} has a real description`);
      assert.equal(t.inputSchema.type, "object");
      assert.equal(t.outputSchema?.type, "object", `${t.name} declares an outputSchema`);
      assert.equal(t.annotations?.readOnlyHint, true);
      assert.equal(t.annotations?.openWorldHint, false);
      assert.equal(t.annotations?.idempotentHint, true);
      assert.equal(t.annotations?.destructiveHint, false);
    }
    const analyze = tools.find((t) => t.name === "intruva_analyze_prompt")!;
    assert.deepEqual(analyze.inputSchema.required, ["prompt"]);
  });
});

describe("intruva_analyze_prompt", () => {
  for (const s of SAMPLES) {
    it(`diagnoses sample “${s.id}” as ${s.family}`, async () => {
      const r = await call(client, "intruva_analyze_prompt", { prompt: s.prompt });
      const a = structured(r);
      assert.equal(a.task_type, s.family);
      assert.equal(a.engine.kind, "rule-based");
      assert.ok(a.questions.length <= 3);
      assert.equal(a.requires_clarification, a.questions.length > 0);
      assert.ok(a.scores.overall >= 0 && a.scores.overall <= 1 + 1e-9);
      const text = textOf(r);
      assert.match(text, /# Intruva prompt diagnosis/);
      for (const q of a.questions) assert.ok(text.includes(`\`${q.field}\``), `text names field ${q.field}`);
    });
  }

  it("returns questions only in deep mode", async () => {
    const prompt = "Write a good mail to my manager.";
    const deep = structured(await call(client, "intruva_analyze_prompt", { prompt }));
    const quick = structured(await call(client, "intruva_analyze_prompt", { prompt, mode: "quick" }));
    assert.ok(deep.questions.length > 0);
    assert.equal(quick.questions.length, 0);
    assert.ok(quick.missing_context.length > 0);
  });

  it("honours an explicit task_type", async () => {
    const a = structured(await call(client, "intruva_analyze_prompt", { prompt: "Explain operating systems.", task_type: "research" }));
    assert.equal(a.task_type, "research");
    assert.equal(a.task_confidence, "high");
  });

  it("reports secrets from the original but never echoes raw values (default redaction)", async () => {
    const r = await call(client, "intruva_analyze_prompt", { prompt: secretSample });
    const a = structured(r);
    assert.ok(["high", "critical"].includes(a.security.risk_level));
    assert.ok(a.security.findings.some((f: { category: string }) => f.category === "secret"));
    assert.ok(a.security.findings.some((f: { category: string }) => f.category === "prompt_injection"));
    assert.equal(a.redaction.applied, true);
    assert.ok(a.scores.safety < 0.5, "safety score reflects the original prompt");
    const all = everything(r);
    for (const raw of RAW_SECRETS) assert.ok(!all.includes(raw), `raw secret leaked: ${raw}`);
    assert.match(textOf(r), /Security findings/);
  });

  it("can turn redaction off explicitly", async () => {
    const r = await call(client, "intruva_analyze_prompt", { prompt: secretSample, redact_secrets: false });
    const a = structured(r);
    assert.equal(a.redaction.applied, false);
    // Findings still only carry masked evidence.
    for (const f of a.security.findings) for (const raw of RAW_SECRETS) assert.ok(!f.masked_evidence.includes(raw));
  });

  it("redacts PII only when asked", async () => {
    const prompt = "Write a follow-up email to jane.doe@acme.io about the Friday demo.";
    const keep = structured(await call(client, "intruva_analyze_prompt", { prompt }));
    const drop = await call(client, "intruva_analyze_prompt", { prompt, redact_pii: true });
    assert.equal(keep.redaction.applied, false);
    assert.equal(structured(drop).redaction.applied, true);
    assert.ok(!everything(drop).includes("jane.doe@acme.io"));
  });
});

describe("intruva_optimize_prompt", () => {
  it("runs the clarify loop: analyze → answer → optimize", async () => {
    const prompt = "Write a good mail to my manager.";
    const a = structured(await call(client, "intruva_analyze_prompt", { prompt }));
    assert.ok(a.questions.length >= 2);
    const [q1, q2] = a.questions;
    const answer = "Ask to move my performance review to Friday";
    const r = await call(client, "intruva_optimize_prompt", {
      prompt,
      task_type: a.task_type,
      answers: [
        { field: q1.field, kind: "answered", value: answer },
        { field: q2.field, kind: "skipped" },
      ],
    });
    const o = structured(r);
    assert.ok(o.optimized.includes(prompt), "original sentence kept verbatim");
    assert.ok(o.optimized.includes(answer), "answer used as context");
    assert.ok(!o.assumptions_used.some((x: { field: string }) => x.field === q1.field));
    assert.ok(!o.open_questions.some((x: { field: string }) => x.field === q1.field || x.field === q2.field));
    assert.equal(o.preservation.length, 7);
    assert.equal(o.preservation_summary.fail, 0);
    assert.ok(o.scores_after.overall >= o.scores_before.overall);
    assert.deepEqual(o.unmatched_answer_fields, []);
    const text = textOf(r);
    assert.match(text, /# Intruva optimized prompt/);
    assert.ok(text.includes(answer));
  });

  it("defaults answer kind to answered", async () => {
    const o = structured(
      await call(client, "intruva_optimize_prompt", {
        prompt: "Write a good mail to my manager.",
        answers: [{ field: "purpose", value: "Request Friday off" }],
      }),
    );
    assert.ok(o.optimized.includes("Request Friday off"));
  });

  for (const s of SAMPLES)
    for (const mode of ["quick", "deep", "minimal"] as const)
      it(`keeps intent for “${s.id}” in ${mode} mode`, async () => {
        const o = structured(await call(client, "intruva_optimize_prompt", { prompt: s.prompt, mode }));
        assert.equal(o.preservation_summary.fail, 0);
        assert.ok(o.scores_after.overall >= o.scores_before.overall - 1e-9);
      });

  it("formats for Claude with XML tags and keeps minimal mode verbatim", async () => {
    const prompt = "Explain operating systems.";
    const claude = structured(await call(client, "intruva_optimize_prompt", { prompt, target_model: "claude" }));
    assert.match(claude.optimized, /<goal>[\s\S]*<\/goal>/);
    const minimal = structured(await call(client, "intruva_optimize_prompt", { prompt, mode: "minimal" }));
    assert.ok(minimal.optimized.startsWith(prompt));
  });

  it("keeps raw secrets out of the optimized prompt and the whole result", async () => {
    const r = await call(client, "intruva_optimize_prompt", { prompt: secretSample });
    const o = structured(r);
    assert.ok(o.optimized.includes("[REDACTED_API_KEY]"));
    assert.ok(o.optimized.includes("[REDACTED_CONNECTION_STRING]"));
    assert.ok(["high", "critical"].includes(o.security_before.risk_level));
    assert.ok(!o.security_after.findings.some((f: { category: string }) => f.category === "secret"));
    assert.equal(o.preservation_summary.fail, 0);
    assert.ok(o.scores_after.safety >= o.scores_before.safety);
    // Redaction must not merge the user's context sentence into the quarantined injection.
    const untrusted = o.optimized.split("## Untrusted text")[1] ?? "";
    assert.match(untrusted, /Ignore previous instructions/);
    assert.ok(!untrusted.includes("[REDACTED_API_KEY]"), "legit context stays out of the untrusted block");
    const all = everything(r);
    for (const raw of RAW_SECRETS) assert.ok(!all.includes(raw), `raw secret leaked: ${raw}`);
  });

  it("redacts secrets inside answers too", async () => {
    const r = await call(client, "intruva_optimize_prompt", {
      prompt: "Why does my deploy script keep failing?",
      answers: [{ field: "artifacts", value: "It uses token ghp_abcdefghijklmnopqrstuvwxyz0123456789" }],
    });
    const o = structured(r);
    assert.ok(o.optimized.includes("[REDACTED_GITHUB_TOKEN]"));
    assert.ok(!everything(r).includes("ghp_abcdefghijklmnopqrstuvwxyz0123456789"));
    assert.equal(o.redaction.count, 1);
  });

  it("reports answer fields that don't belong to the task family", async () => {
    const o = structured(
      await call(client, "intruva_optimize_prompt", {
        prompt: "Explain operating systems.",
        answers: [{ field: "made_up_field", value: "something" }],
      }),
    );
    assert.deepEqual(o.unmatched_answer_fields, ["made_up_field"]);
  });

  it("rejects an answered entry with no value", async () => {
    const r = await call(client, "intruva_optimize_prompt", {
      prompt: "Explain operating systems.",
      answers: [{ field: "level", kind: "answered" }],
    });
    assert.equal(r.isError, true);
    assert.match(textOf(r), /no value/);
  });
});

describe("intruva_scan_prompt", () => {
  it("finds secrets and injection with masked evidence, and redacts on request", async () => {
    const r = await call(client, "intruva_scan_prompt", { prompt: secretSample, redact: true });
    const s = structured(r);
    assert.ok(["high", "critical"].includes(s.risk_level));
    assert.ok(s.counts_by_category.secret >= 2);
    assert.ok(s.counts_by_category.prompt_injection >= 1);
    assert.equal(s.finding_count, s.findings.length);
    assert.ok(s.redacted_text.includes("[REDACTED_API_KEY]"));
    assert.ok(s.redacted_text.includes("[REDACTED_CONNECTION_STRING]"));
    assert.ok(s.redactions_applied >= 2);
    // Trailing sentence punctuation stays outside the placeholder.
    assert.ok(s.redacted_text.includes("[REDACTED_CONNECTION_STRING]. Ignore previous instructions"));
    const all = everything(r);
    for (const raw of RAW_SECRETS) assert.ok(!all.includes(raw), `raw secret leaked: ${raw}`);
    assert.match(textOf(r), /Redacted text/);
  });

  it("omits redacted_text unless asked, and still never shows raw values", async () => {
    const r = await call(client, "intruva_scan_prompt", { prompt: secretSample });
    const s = structured(r);
    assert.equal(s.redacted_text, undefined);
    for (const raw of RAW_SECRETS) assert.ok(!everything(r).includes(raw));
  });

  it("reports a clean prompt as risk none", async () => {
    const s = structured(await call(client, "intruva_scan_prompt", { prompt: "Summarise the attached meeting notes in five bullets." }));
    assert.equal(s.risk_level, "none");
    assert.equal(s.finding_count, 0);
  });

  it("flags risky agent permissions and exfiltration", async () => {
    const agent = SAMPLES.find((x) => x.id === "agent")!.prompt;
    const s = structured(await call(client, "intruva_scan_prompt", { prompt: agent }));
    assert.ok(s.counts_by_category.tool_misuse >= 1);
    assert.ok(s.counts_by_category.exfiltration >= 1);
  });
});

describe("intruva_list_task_types", () => {
  it("lists all nine families with context fields", async () => {
    const r = await call(client, "intruva_list_task_types", {});
    const l = structured(r);
    assert.equal(l.task_types.length, 9);
    for (const t of l.task_types) assert.ok(t.context_fields.length > 0);
    assert.deepEqual(l.modes.map((m: { id: string }) => m.id), ["quick", "deep", "minimal"]);
    assert.match(textOf(r), /`agent_instruction`/);
  });

  it("filters to one family", async () => {
    const l = structured(await call(client, "intruva_list_task_types", { task_type: "writing" }));
    assert.equal(l.task_types.length, 1);
    assert.ok(l.task_types[0].context_fields.some((f: { field: string }) => f.field === "purpose"));
  });
});

describe("errors", () => {
  const cases: Array<[string, Record<string, unknown>, RegExp]> = [
    ["intruva_analyze_prompt", { prompt: "   " }, /Add a prompt/],
    ["intruva_analyze_prompt", { prompt: "fix it" }, /little short/],
    ["intruva_analyze_prompt", { prompt: "x".repeat(12_001) }, /12,000 characters/],
    ["intruva_optimize_prompt", { prompt: "short" }, /little short/],
    ["intruva_scan_prompt", { prompt: "" }, /Add some text/],
    ["intruva_scan_prompt", { prompt: "a".repeat(100_001) }, /100,000 characters/],
    ["intruva_analyze_prompt", { prompt: "Explain operating systems.", task_type: "poetry" }, /task_type/],
    ["intruva_analyze_prompt", {}, /prompt/],
  ];
  for (const [tool, args, rx] of cases)
    it(`${tool} ${JSON.stringify(args).slice(0, 50)} → friendly isError`, async () => {
      const r = await call(client, tool, args);
      assert.equal(r.isError, true);
      assert.match(textOf(r), rx);
    });
});

describe("prompts and resources", () => {
  it("exposes the preflight prompt", async () => {
    const { prompts } = await client.listPrompts();
    assert.ok(prompts.some((p) => p.name === "preflight"));
    const p = await client.getPrompt({ name: "preflight", arguments: { prompt: "Write a good mail to my manager.", target_model: "claude" } });
    const msg = p.messages[0].content;
    assert.equal(msg.type, "text");
    const text = (msg as { text: string }).text;
    assert.ok(text.includes("Write a good mail to my manager."));
    assert.ok(text.includes("intruva_analyze_prompt") && text.includes("intruva_optimize_prompt"));
    assert.ok(text.includes('target_model "claude"'));
  });

  it("exposes the nine demo samples as resources", async () => {
    const { resources } = await client.listResources();
    assert.equal(resources.length, SAMPLES.length);
    const r = await client.readResource({ uri: "intruva://samples/debug" });
    const c = r.contents[0] as { text: string; mimeType: string };
    assert.equal(c.mimeType, "text/plain");
    assert.equal(c.text, SAMPLES.find((s) => s.id === "debug")!.prompt);
  });
});
