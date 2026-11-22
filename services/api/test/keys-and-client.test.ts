import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { handle } from "../src/app";
import { IntruvaApiError, IntruvaClient } from "../src/client";
import { resetFallbackLimiters } from "../src/ratelimit";
import { BASE, KEY, makeEnv } from "./helpers";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../scripts/create-api-key.mjs");
const origLog = console.log;
beforeEach(() => {
  console.log = () => {};
  resetFallbackLimiters();
});
afterEach(() => {
  console.log = origLog;
});

describe("scripts/create-api-key.mjs", () => {
  it("--json: the generated key authenticates against a registry holding only its hash", async () => {
    const out = JSON.parse(execFileSync(process.execPath, [SCRIPT, "pilot-co", "--json", "--no-registry"], { encoding: "utf8" }));
    assert.match(out.key, /^itv_[A-Za-z0-9_-]{43}$/);
    assert.match(out.hash, /^[0-9a-f]{64}$/);
    assert.equal(out.entry, `pilot-co:${out.hash}`);
    assert.ok(!out.entry.includes(out.key));

    const env = await makeEnv({ API_KEYS: out.entry });
    const ok = await handle(
      new Request(`${BASE}/v1/security/scan`, {
        method: "POST",
        headers: { authorization: `Bearer ${out.key}`, "content-type": "application/json" },
        body: JSON.stringify({ text: "hello there world" }),
      }),
      env,
    );
    assert.equal(ok.status, 200);
  });

  it("--entry-only: stdout is exactly the secret line, stderr is the plaintext key", () => {
    const r = execFileSync(process.execPath, [SCRIPT, "ci", "--entry-only", "--no-registry"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.match(r, /^ci:[0-9a-f]{64}\n$/);
    assert.doesNotMatch(r, /itv_/);
  });

  it("rejects bad labels and extra arguments", () => {
    for (const args of [["bad label"], ["a", "b"], ["x", "--bogus"], []]) {
      assert.throws(() => execFileSync(process.execPath, [SCRIPT, ...args, "--no-registry"], { stdio: "pipe" }));
    }
  });
});

describe("typed client (src/client.ts)", () => {
  const client = async (apiKey = KEY) => {
    const env = await makeEnv();
    const f = ((input: RequestInfo | URL, init?: RequestInit) => handle(new Request(input, init), env)) as typeof fetch;
    return new IntruvaClient({ baseUrl: BASE + "/", apiKey, fetch: f });
  };

  it("health, analyze, optimize, scan, feedback round-trip", async () => {
    const c = await client();
    assert.equal((await c.health()).mode, "rule-based");
    const prompt = "Write a launch email to our customers about the new billing dashboard. Keep it under 150 words.";
    const a = await c.analyze({ prompt, mode: "deep" });
    assert.equal(a.task_type, "writing");
    const o = await c.optimize({ prompt, answers: a.questions.map((q) => ({ field: q.field, kind: "skipped" as const })) });
    assert.ok(o.optimized.includes("Keep it under 150 words."));
    const s = await c.scan("ping ops@acme-corp.io about the outage please", { redact: true });
    assert.equal(s.redacted_text, "ping [EMAIL] about the outage please");
    const fb = await c.feedback({ request_id: o.request_id, rating: "up", consent_benchmark: false });
    assert.equal(fb.accepted, true);
  });

  it("throws IntruvaApiError with code, status and request id", async () => {
    const c = await client("itv_wrongwrongwrongwrongwrong");
    await assert.rejects(c.analyze({ prompt: "hello there world" }), (e: unknown) => {
      assert.ok(e instanceof IntruvaApiError);
      assert.equal(e.status, 401);
      assert.equal(e.code, "invalid_api_key");
      assert.match(e.requestId!, /^req_/);
      return true;
    });
  });
});
