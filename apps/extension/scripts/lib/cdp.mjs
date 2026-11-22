/**
 * Minimal Chrome DevTools Protocol client over --remote-debugging-pipe.
 *
 * Why a pipe and not a port: branded Chrome (137+) ignores --load-extension,
 * so the E2E test loads the unpacked build with the CDP command
 * `Extensions.loadUnpacked`, which Chrome only exposes over a pipe connection
 * started with --enable-unsafe-extension-debugging. No extra npm packages.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const DEFAULT_CHROME =
  process.env.CHROME_PATH ||
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].find((p) => existsSync(p));

export async function launchChrome({ chromePath = DEFAULT_CHROME, headless = true, extraArgs = [] } = {}) {
  if (!chromePath) throw new Error("Chrome not found. Set CHROME_PATH.");
  const userDataDir = mkdtempSync(join(tmpdir(), "intruva-chrome-"));
  const args = [
    ...(headless ? ["--headless=new"] : []),
    "--remote-debugging-pipe",
    "--enable-unsafe-extension-debugging",
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--password-store=basic",
    "--use-mock-keychain",
    "--window-size=1280,900",
    ...extraArgs,
    "about:blank",
  ];
  const proc = spawn(chromePath, args, { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  const stderr = [];
  proc.stderr.on("data", (d) => stderr.push(String(d)));
  const conn = new PipeConnection(proc.stdio[3], proc.stdio[4]);
  const close = async () => {
    try {
      await Promise.race([conn.send("Browser.close"), new Promise((r) => setTimeout(r, 2000))]);
    } catch {
      /* already gone */
    }
    proc.kill("SIGKILL");
    await new Promise((r) => setTimeout(r, 200));
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  };
  proc.on("exit", () => conn.dispose(new Error(`Chrome exited.\n${stderr.join("").slice(-2000)}`)));
  // Prove the pipe is alive.
  await conn.send("Browser.getVersion");
  return { conn, close, proc, stderr };
}

class PipeConnection {
  #id = 0;
  #pending = new Map();
  #listeners = new Set();
  #buf = "";
  #closed = null;

  constructor(writable, readable) {
    this.writable = writable;
    readable.on("data", (chunk) => {
      this.#buf += chunk.toString("utf8");
      let idx;
      while ((idx = this.#buf.indexOf("\0")) >= 0) {
        const raw = this.#buf.slice(0, idx);
        this.#buf = this.#buf.slice(idx + 1);
        this.#dispatch(JSON.parse(raw));
      }
    });
  }

  #dispatch(msg) {
    if (msg.id !== undefined && this.#pending.has(msg.id)) {
      const { resolve, reject, method } = this.#pending.get(msg.id);
      this.#pending.delete(msg.id);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
      else resolve(msg.result);
      return;
    }
    for (const l of this.#listeners) l(msg);
  }

  send(method, params = {}, sessionId) {
    if (this.#closed) return Promise.reject(this.#closed);
    const id = ++this.#id;
    const msg = { id, method, params, ...(sessionId ? { sessionId } : {}) };
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method });
      this.writable.write(JSON.stringify(msg) + "\0");
    });
  }

  on(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Resolve with the first event matching `pred`, or reject after `timeout` ms. */
  waitFor(pred, timeout = 10_000, label = "event") {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        off();
        reject(new Error(`Timed out waiting for ${label}`));
      }, timeout);
      const off = this.on((msg) => {
        if (pred(msg)) {
          clearTimeout(t);
          off();
          resolve(msg);
        }
      });
    });
  }

  dispose(err) {
    this.#closed = err;
    for (const { reject } of this.#pending.values()) reject(err);
    this.#pending.clear();
  }
}

/** Open a page target and return a small session helper bound to it. */
export async function openPage(conn, url = "about:blank") {
  const { targetId } = await conn.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await conn.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => conn.send(method, params, sessionId);
  await send("Page.enable");
  await send("Runtime.enable");
  const page = {
    targetId,
    sessionId,
    send,
    async goto(u) {
      const loaded = conn.waitFor((m) => m.sessionId === sessionId && m.method === "Page.loadEventFired", 15_000, `load ${u}`);
      await send("Page.navigate", { url: u });
      await loaded;
    },
    async eval(expression) {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) {
        throw new Error(`eval failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      }
      return r.result.value;
    },
    async waitFor(expression, timeout = 10_000, label = expression) {
      const end = Date.now() + timeout;
      let last;
      while (Date.now() < end) {
        try {
          last = await page.eval(expression);
          if (last) return last;
        } catch (e) {
          last = e;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`Timed out waiting for: ${label} (last: ${last instanceof Error ? last.message : JSON.stringify(last)})`);
    },
    async click(x, y) {
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
        await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
      }
    },
    async key(key, code, modifiers = 0, keyCode) {
      const base = { key, code, modifiers, windowsVirtualKeyCode: keyCode };
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base });
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    },
  };
  if (url !== "about:blank") await page.goto(url);
  return page;
}
