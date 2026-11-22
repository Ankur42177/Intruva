/**
 * End-to-end tests against the BUILT bundle (dist/index.js): stdio with the
 * SDK's StdioClientTransport, raw stdio JSON-RPC framing, and Streamable HTTP.
 * Run `npm run build` first (the `test` script does).
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { request } from "node:http";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SAMPLES } from "@intruva/engine";
import { call, everything, RAW_SECRETS, structured, textOf } from "./helpers";

const BIN = join(dirname(fileURLToPath(import.meta.url)), "../dist/index.js");
const secretSample = SAMPLES.find((s) => s.id === "secret")!.prompt;

before(() => {
  assert.ok(existsSync(BIN), "dist/index.js missing: run `npm run build` first");
});

describe("built bin over stdio (SDK client)", () => {
  let client: Client;
  let transport: StdioClientTransport;
  let stderr = "";

  before(async () => {
    transport = new StdioClientTransport({ command: process.execPath, args: [BIN], stderr: "pipe" });
    transport.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    client = new Client({ name: "intruva-e2e", version: "0.0.0" });
    await client.connect(transport);
  });
  after(async () => {
    await client.close();
  });

  it("initializes and lists tools, prompts and resources", async () => {
    assert.equal(client.getServerVersion()?.name, "intruva");
    const { tools } = await client.listTools();
    assert.equal(tools.length, 4);
    assert.ok((await client.listPrompts()).prompts.some((p) => p.name === "preflight"));
    assert.equal((await client.listResources()).resources.length, SAMPLES.length);
  });

  it("analyzes, optimizes with answers, and scans", async () => {
    const prompt = "Write a good mail to my manager.";
    const a = structured(await call(client, "intruva_analyze_prompt", { prompt }));
    assert.equal(a.task_type, "writing");
    const field = a.questions[0].field;
    const o = structured(
      await call(client, "intruva_optimize_prompt", { prompt, answers: [{ field, value: "Ask for Friday off" }] }),
    );
    assert.ok(o.optimized.includes("Ask for Friday off"));
    const s = await call(client, "intruva_scan_prompt", { prompt: secretSample, redact: true });
    assert.ok(structured(s).redacted_text.includes("[REDACTED_API_KEY]"));
    for (const raw of RAW_SECRETS) assert.ok(!everything(s).includes(raw));
  });

  it("returns friendly validation errors", async () => {
    const r = await call(client, "intruva_analyze_prompt", { prompt: "hi" });
    assert.equal(r.isError, true);
    assert.match(textOf(r), /little short/);
  });

  it("logs only startup info to stderr, never prompt content", () => {
    assert.match(stderr, /running on stdio/);
    assert.ok(!stderr.includes("manager"));
    for (const raw of RAW_SECRETS) assert.ok(!stderr.includes(raw));
  });
});

describe("built bin over stdio (raw JSON-RPC framing)", () => {
  it("writes only newline-delimited JSON-RPC to stdout and exits when stdin closes", async () => {
    const child = spawn(process.execPath, [BIN], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    const send = (msg: object) => child.stdin.write(JSON.stringify(msg) + "\n");
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "raw", version: "0" } },
    });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "intruva_scan_prompt", arguments: { prompt: secretSample } },
    });
    await waitFor(() => stdout.split("\n").filter(Boolean).length >= 2, 10_000);
    const exited = new Promise<number | null>((res) => child.once("exit", (code) => res(code)));
    child.stdin.end();
    assert.equal(await withTimeout(exited, 5_000), 0);

    const lines = stdout.split("\n").filter(Boolean);
    const msgs = lines.map((l) => JSON.parse(l)); // throws if anything else leaked onto stdout
    assert.equal(msgs[0].id, 1);
    assert.equal(msgs[0].result.serverInfo.name, "intruva");
    assert.equal(msgs[1].id, 2);
    assert.ok(msgs[1].result.structuredContent.finding_count >= 3);
    for (const raw of RAW_SECRETS) assert.ok(!stdout.includes(raw));
  });

  it("prints --version and rejects unknown flags", async () => {
    const v = await run([BIN, "--version"]);
    assert.equal(v.code, 0);
    assert.match(v.stdout, /^\d+\.\d+\.\d+/);
    const bad = await run([BIN, "--nope"]);
    assert.equal(bad.code, 2);
    assert.match(bad.stderr, /unknown argument/);
  });
});

describe("built bin over Streamable HTTP", () => {
  let child: ChildProcess;
  let url: URL;

  before(async () => {
    child = spawn(process.execPath, [BIN, "--http", "--port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr!.on("data", (d: Buffer) => (stderr += d.toString()));
    await waitFor(() => /listening on (\S+)/.test(stderr), 10_000);
    url = new URL(/listening on (\S+)/.exec(stderr)![1]);
    assert.equal(url.hostname, "127.0.0.1");
  });
  after(() => {
    child.kill("SIGTERM");
  });

  it("serves tools to the SDK Streamable HTTP client", async () => {
    const client = new Client({ name: "intruva-http", version: "0.0.0" });
    await client.connect(new StreamableHTTPClientTransport(url));
    const { tools } = await client.listTools();
    assert.equal(tools.length, 4);
    const a = structured(await call(client, "intruva_analyze_prompt", { prompt: "Design a URL shortener like the ones big companies use." }));
    assert.equal(a.task_type, "system_design");
    await client.close();
  });

  it("answers /healthz and rejects GET /mcp, unknown paths, and foreign Host/Origin headers", async () => {
    const health = await httpReq(url, "/healthz", "GET");
    assert.equal(health.status, 200);
    assert.equal(JSON.parse(health.body).ok, true);
    assert.equal((await httpReq(url, "/mcp", "GET")).status, 405);
    assert.equal((await httpReq(url, "/other", "GET")).status, 404);
    assert.equal((await httpReq(url, "/healthz", "GET", { host: "evil.example:80" })).status, 403);
    assert.equal((await httpReq(url, "/mcp", "POST", { origin: "https://evil.example" })).status, 403);
  });
});

/* ----------------------------------------------------------------- helpers */

async function waitFor(cond: () => boolean, ms: number) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("timed out waiting for condition");
    await new Promise((r) => setTimeout(r, 25));
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

function run(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, args);
    let stdout = "";
    let stderr = "";
    c.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    c.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    c.on("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

function httpReq(base: URL, path: string, method: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request(
      { host: base.hostname, port: base.port, path, method, headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers } },
      (res) => {
        let body = "";
        res.on("data", (d: Buffer) => (body += d.toString()));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("error", reject);
    req.end(method === "POST" ? "{}" : undefined);
  });
}
