/**
 * Extension settings, persisted in chrome.storage.local. Prompts are never
 * stored — only these preferences.
 */
import type { OptimizeMode } from "@intruva/engine";

export const SETTINGS_KEY = "intruva:settings";
export const DEFAULT_WEB_APP_URL = "http://localhost:3001/workspace/";

export interface RemoteSettings {
  /** User opted in. Only effective when `isRemoteConfigured` is also true. */
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
}

export interface Settings {
  defaultMode: OptimizeMode;
  showLauncher: boolean;
  webAppUrl: string;
  remote: RemoteSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultMode: "quick",
  showLauncher: true,
  webAppUrl: DEFAULT_WEB_APP_URL,
  remote: { enabled: false, apiUrl: "", apiKey: "" },
};

const MODES: OptimizeMode[] = ["quick", "deep", "minimal"];

/** Returns an error message, or null when the URL is an acceptable http(s) URL. */
export function validateHttpUrl(raw: string, { requireHttps = false } = {}): string | null {
  const v = raw.trim();
  if (!v) return "Enter a URL.";
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return "That isn't a valid URL.";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "Use an http(s) URL.";
  if (u.username || u.password) return "Don't put credentials in the URL.";
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (requireHttps && u.protocol !== "https:" && !local) return "Use https:// (http is only allowed for localhost).";
  return null;
}

/** Chrome match pattern for the API origin, used for the optional host permission. */
export function originPattern(apiUrl: string): string | null {
  try {
    const u = new URL(apiUrl.trim());
    return `${u.protocol}//${u.hostname}/*`;
  } catch {
    return null;
  }
}

export function isRemoteConfigured(s: Settings): boolean {
  return validateHttpUrl(s.remote.apiUrl, { requireHttps: true }) === null && s.remote.apiKey.trim().length >= 8;
}

export function isRemoteActive(s: Settings): boolean {
  return s.remote.enabled && isRemoteConfigured(s);
}

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings> & { remote?: Partial<RemoteSettings> };
  const remote = r.remote && typeof r.remote === "object" ? r.remote : {};
  const webAppUrl =
    typeof r.webAppUrl === "string" && validateHttpUrl(r.webAppUrl) === null ? r.webAppUrl.trim() : DEFAULT_WEB_APP_URL;
  return {
    defaultMode: MODES.includes(r.defaultMode as OptimizeMode) ? (r.defaultMode as OptimizeMode) : "quick",
    showLauncher: typeof r.showLauncher === "boolean" ? r.showLauncher : true,
    webAppUrl,
    remote: {
      enabled: remote.enabled === true,
      apiUrl: typeof remote.apiUrl === "string" ? remote.apiUrl.trim() : "",
      apiKey: typeof remote.apiKey === "string" ? remote.apiKey.trim() : "",
    },
  };
}

type StorageArea = Pick<chrome.storage.StorageArea, "get" | "set">;

const area = (): StorageArea | null =>
  typeof chrome !== "undefined" && chrome.storage?.local ? chrome.storage.local : null;

export async function loadSettings(storage: StorageArea | null = area()): Promise<Settings> {
  if (!storage) return { ...DEFAULT_SETTINGS, remote: { ...DEFAULT_SETTINGS.remote } };
  const got = await storage.get(SETTINGS_KEY);
  return normalizeSettings(got[SETTINGS_KEY]);
}

export async function saveSettings(next: Settings, storage: StorageArea | null = area()): Promise<Settings> {
  const clean = normalizeSettings(next);
  // Remote can't be "on" without a usable configuration.
  if (!isRemoteConfigured(clean)) clean.remote.enabled = false;
  await storage?.set({ [SETTINGS_KEY]: clean });
  return clean;
}
