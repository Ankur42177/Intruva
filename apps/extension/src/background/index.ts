/**
 * Service worker. Deliberately small:
 *  - keyboard shortcut → tell the active tab's content script to toggle the panel
 *  - open the Intruva web app in a new tab (URL from settings, never with prompt text)
 *  - optional remote analysis (off by default). The network call happens here,
 *    not in the page, so the API key is never exposed to the site.
 * No telemetry, no logging of prompts, no storage of prompts.
 */
import type { BackgroundMessage, OpenWebAppResponse, RemoteOptimizeResponse } from "../core/messages";
import { COMMAND_TOGGLE } from "../core/messages";
import { callRemoteOptimize } from "../core/remote";
import { isRemoteActive, loadSettings, originPattern, validateHttpUrl } from "../core/settings";

export async function handleCommand(command: string, tab?: chrome.tabs.Tab): Promise<boolean> {
  if (command !== COMMAND_TOGGLE) return false;
  let tabId = tab?.id;
  if (tabId === undefined) {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    tabId = active?.id;
  }
  if (tabId === undefined) return false;
  try {
    await chrome.tabs.sendMessage(tabId, { type: "intruva:toggle" });
    return true;
  } catch {
    // Not a supported site (no content script there). Nothing to do.
    return false;
  }
}

async function openWebApp(): Promise<OpenWebAppResponse> {
  const settings = await loadSettings();
  if (validateHttpUrl(settings.webAppUrl)) return { ok: false, error: "The web app URL in Options is invalid." };
  await chrome.tabs.create({ url: settings.webAppUrl });
  return { ok: true };
}

async function remoteOptimize(msg: Extract<BackgroundMessage, { type: "intruva:remote-optimize" }>): Promise<RemoteOptimizeResponse> {
  const settings = await loadSettings();
  if (!isRemoteActive(settings)) return { ok: false, error: "Remote analysis is off." };
  const pattern = originPattern(settings.remote.apiUrl);
  if (!pattern || !(await chrome.permissions.contains({ origins: [pattern] }))) {
    return { ok: false, error: "Permission for the API host hasn't been granted. Re-enable remote analysis in Options." };
  }
  try {
    const { result, redacted } = await callRemoteOptimize(settings, msg.request);
    return { ok: true, result, redacted, host: new URL(settings.remote.apiUrl).host };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Remote analysis failed." };
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  void handleCommand(command, tab);
});

chrome.runtime.onMessage.addListener((msg: BackgroundMessage, sender, sendResponse) => {
  // Only accept messages from our own extension contexts / content scripts.
  if (sender.id !== chrome.runtime.id) return;
  if (msg?.type === "intruva:open-webapp") {
    openWebApp().then(sendResponse, () => sendResponse({ ok: false, error: "Couldn't open the web app." }));
    return true;
  }
  if (msg?.type === "intruva:remote-optimize") {
    remoteOptimize(msg).then(sendResponse, () => sendResponse({ ok: false, error: "Remote analysis failed." }));
    return true;
  }
  return;
});

if (__INTRUVA_DEV__) {
  // Test hook for the E2E suite (dev builds only).
  (globalThis as Record<string, unknown>).__intruva = { handleCommand };
}
