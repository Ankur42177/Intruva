#!/usr/bin/env node
/**
 * Create an Intruva API key.
 *
 *   node scripts/create-api-key.mjs <label> [--registry <file>] [--json | --entry-only] [--no-registry]
 *
 * Non-interactive / CI use (stdout = secret value, stderr = plaintext key):
 *   node scripts/create-api-key.mjs acme --entry-only --no-registry 2>acme.key \
 *     | npx wrangler secret put API_KEYS --cwd services/api
 * (That replaces API_KEYS with this single entry. To keep existing keys, upload
 * the whole registry file instead — see the printed command.)
 *
 * Prints the raw key ONCE (give it to the customer over a secure channel; it is
 * not stored anywhere) and its SHA-256 hash. The Worker only ever stores the
 * hash, inside the `API_KEYS` secret as `label:hash` lines.
 *
 * Because Worker secrets cannot be read back, the full list of `label:hash`
 * entries lives in a local registry file (default: services/api/.api-keys,
 * git-ignored). This script appends the new entry there and prints the exact
 * command that uploads the whole registry as the secret. Hashes of 256-bit
 * random keys are not useful to an attacker, but keep the file private anyway.
 *
 * Revoke a key: delete its line from the registry and re-run the printed
 * `wrangler secret put` command.
 */
import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const boolFlag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};
const asJson = boolFlag("--json");
const entryOnly = boolFlag("--entry-only");
const noRegistry = boolFlag("--no-registry");
const registry = path.resolve(flag("--registry") ?? path.join(root, "services/api/.api-keys"));
const label = args[0];

if (args.length !== 1 || args.some((a) => a.startsWith("--")) ||
    !label || !/^[A-Za-z0-9_.-]{1,64}$/.test(label)) {
  console.error("Usage: node scripts/create-api-key.mjs <label> [--registry <file>] [--json | --entry-only] [--no-registry]");
  console.error("  <label>: 1–64 chars of A–Z a–z 0–9 _ . -   e.g. acme-pilot");
  process.exit(1);
}

const existing = !noRegistry && existsSync(registry) ? readFileSync(registry, "utf8") : "";
if (existing.split("\n").some((l) => l.trim().startsWith(`${label}:`))) {
  console.error(`Label "${label}" already exists in ${registry}. Revoke it first or pick another label.`);
  process.exit(1);
}

const key = `itv_${randomBytes(32).toString("base64url")}`;
const hash = createHash("sha256").update(key).digest("hex");
const entry = `${label}:${hash}`;

const header = existing ? "" : "# Intruva API key registry (label:sha256). Upload with `wrangler secret put API_KEYS`.\n";
if (!noRegistry) appendFileSync(registry, `${header}${entry}\n`, { mode: 0o600 });

const shortPath = (p) => {
  const r = path.relative(process.cwd(), p);
  return !r ? "." : r.startsWith("..") ? p : r;
};
const rel = shortPath(registry);
const apiDir = shortPath(path.join(root, "services/api"));
const putCmd = `npx wrangler secret put API_KEYS --cwd "${apiDir}" < "${rel}"`;

if (entryOnly) {
  // stdout: exactly the secret value for this key; stderr: the plaintext key (shown once).
  process.stdout.write(`${entry}\n`);
  process.stderr.write(`${key}\n`);
} else if (asJson) {
  console.log(JSON.stringify({ label, key, hash, entry, registry: noRegistry ? null : registry, command: putCmd }, null, 2));
} else {
  console.log(`
API key created for "${label}"

  Key (shown once — send it to the customer securely; it is not saved):
    ${key}

  SHA-256 hash (what the Worker stores):
    ${hash}

  Registry entry (the API_KEYS secret line)${noRegistry ? "" : ` — appended to ${rel}`}:
    ${entry}

Upload the full registry as the Worker secret (replaces the previous value):
    ${putCmd}

Local dev (wrangler dev): put the same value in services/api/.dev.vars, e.g.
    API_KEYS="${entry}"

Revoke: delete the line from ${rel} and re-run the upload command.
`);
}
