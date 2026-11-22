/**
 * API key auth (no database).
 *
 * Keys look like `itv_<43 base64url chars>` (256 bits of randomness). The Worker
 * only ever sees SHA-256 hashes of valid keys, supplied through the `API_KEYS`
 * secret as `label:hash` entries. A presented key is hashed and compared
 * against every entry in constant time (no early exit), so timing reveals
 * neither which entry matched nor how many characters did.
 */
import { ApiError } from "./errors";
import type { Env } from "./env";

export const KEY_PREFIX = "itv_";
const KEY_RX = /^itv_[A-Za-z0-9_-]{16,200}$/;
const LABEL_RX = /^[A-Za-z0-9_.-]{1,64}$/;
const HASH_RX = /^[0-9a-f]{64}$/;

export interface KeyEntry {
  label: string;
  hash: string;
}

export type Principal =
  | { kind: "api_key"; label: string; rateKey: string }
  | { kind: "anonymous"; label: "anonymous"; rateKey: string };

let cachedRaw: string | undefined;
let cachedEntries: KeyEntry[] = [];

/** Parse `label:hash` entries (newline or comma separated, `#` comments allowed). Invalid lines are ignored. */
export function parseKeyRegistry(raw: string | undefined): KeyEntry[] {
  if (raw === cachedRaw) return cachedEntries;
  const entries: KeyEntry[] = [];
  for (const line of (raw ?? "").split(/[\n,]/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.lastIndexOf(":");
    if (i < 1) continue;
    const label = t.slice(0, i).trim();
    const hash = t.slice(i + 1).trim().toLowerCase();
    if (LABEL_RX.test(label) && HASH_RX.test(hash)) entries.push({ label, hash });
  }
  cachedRaw = raw;
  cachedEntries = entries;
  return entries;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison for equal-length ASCII strings (hex digests). */
export function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  return diff === 0;
}

export function originMatches(origin: string, list: string | undefined): boolean {
  if (!origin || !list) return false;
  for (const raw of list.split(",")) {
    const pat = raw.trim().replace(/\/$/, "");
    if (!pat) continue;
    if (pat === "*") return true;
    if (pat === origin) return true;
    const star = pat.indexOf("://*.");
    if (star !== -1) {
      const scheme = pat.slice(0, star);
      const suffix = pat.slice(star + 4); // ".example.com" (keeps the dot)
      if (origin.startsWith(scheme + "://") && origin.endsWith(suffix)) {
        const host = origin.slice(scheme.length + 3, origin.length - suffix.length);
        if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/i.test(host)) return true;
      }
    }
  }
  return false;
}

export async function authenticate(req: Request, env: Env): Promise<Principal> {
  const header = req.headers.get("authorization");
  if (!header) {
    const origin = req.headers.get("origin") ?? "";
    if (originMatches(origin, env.ANONYMOUS_ORIGINS)) {
      const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
      return { kind: "anonymous", label: "anonymous", rateKey: `ip:${ip}` };
    }
    throw new ApiError(401, "missing_api_key", "Missing API key. Send `Authorization: Bearer itv_…`.", {
      "WWW-Authenticate": 'Bearer realm="intruva"',
    });
  }
  const m = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(header);
  if (!m) {
    throw new ApiError(401, "invalid_authorization", "Authorization header must be `Bearer <api key>`.", {
      "WWW-Authenticate": 'Bearer realm="intruva", error="invalid_request"',
    });
  }
  const token = m[1];
  const invalid = () =>
    new ApiError(401, "invalid_api_key", "Invalid or revoked API key.", {
      "WWW-Authenticate": 'Bearer realm="intruva", error="invalid_token"',
    });
  if (!KEY_RX.test(token)) throw invalid();

  const hash = await sha256Hex(token);
  let matched: KeyEntry | undefined;
  for (const entry of parseKeyRegistry(env.API_KEYS)) {
    // No early exit: always compare against every entry.
    if (timingSafeEqual(hash, entry.hash) && !matched) matched = entry;
  }
  if (!matched) throw invalid();
  return { kind: "api_key", label: matched.label, rateKey: `key:${matched.hash.slice(0, 32)}` };
}
