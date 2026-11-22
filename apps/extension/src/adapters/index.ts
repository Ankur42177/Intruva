import { chatgptAdapter } from "./chatgpt";
import { claudeAdapter } from "./claude";
import { geminiAdapter } from "./gemini";
import type { LocationLike, SiteAdapter, SiteId } from "./types";

export type { SiteAdapter, SiteId, ComposerHealth, WriteResult, LocationLike } from "./types";

export const ADAPTERS: readonly SiteAdapter[] = [chatgptAdapter, claudeAdapter, geminiAdapter];

export const ADAPTERS_BY_ID: Record<SiteId, SiteAdapter> = {
  chatgpt: chatgptAdapter,
  claude: claudeAdapter,
  gemini: geminiAdapter,
};

/** Local fixture server used by the dev build and the E2E test. */
export const FIXTURE_HOST = "127.0.0.1";
export const FIXTURE_PORT = "5179";

/**
 * Pick the adapter for a page. In dev builds, fixture pages at
 * http://127.0.0.1:5179/<site>*.html map onto the real site adapters so the
 * same selectors and write paths are exercised end to end.
 */
export function resolveAdapter(loc: LocationLike, dev = false): SiteAdapter | null {
  const hit = ADAPTERS.find((a) => a.matches(loc));
  if (hit) return hit;
  if (dev && loc.hostname === FIXTURE_HOST && (loc.port ?? "") === FIXTURE_PORT) {
    const m = /^\/(chatgpt|claude|gemini)\b/.exec(loc.pathname);
    if (m) return ADAPTERS_BY_ID[m[1] as SiteId];
  }
  return null;
}
