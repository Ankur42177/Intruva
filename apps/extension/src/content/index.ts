/**
 * Content script entry. Runs only on the supported chat sites (and, in dev
 * builds, the local fixture server). It mounts the Intruva button and waits
 * for an explicit user action — a click, the keyboard shortcut, or the popup's
 * "Open" button — before reading the composer.
 */
import { resolveAdapter } from "../adapters";
import type { SiteAdapter } from "../adapters/types";
import { runLocal, type RunInput, type RunOutcome } from "../core/engine";
import type { ContentMessage, PingResponse, RemoteOptimizeResponse } from "../core/messages";
import { PanelSession, type ComposerPort } from "../core/session";
import { SETTINGS_KEY, isRemoteActive, loadSettings, normalizeSettings, type Settings } from "../core/settings";
import { toRequest } from "../core/engine";
import { IntruvaUI } from "./ui";
import { copyText } from "./clipboard";

export function composerPort(adapter: SiteAdapter, doc: Document = document): ComposerPort {
  return {
    locate() {
      const el = adapter.findComposer(doc);
      return el ? { ok: true } : { ok: false, reason: adapter.health(doc).reason ?? "Message box not found." };
    },
    read() {
      const el = adapter.findComposer(doc);
      return el ? adapter.readText(el) : null;
    },
    async write(text: string) {
      const el = adapter.findComposer(doc);
      if (!el) return { ok: false, method: "none", reason: "The message box disappeared." };
      return adapter.writeText(el, text);
    },
  };
}

function remoteHost(s: Settings): string | null {
  if (!isRemoteActive(s)) return null;
  try {
    return new URL(s.remote.apiUrl).host;
  } catch {
    return null;
  }
}

async function main() {
  const g = globalThis as typeof globalThis & { __intruvaContentLoaded?: boolean };
  if (g.__intruvaContentLoaded) return;
  g.__intruvaContentLoaded = true;

  const adapter = resolveAdapter(location, __INTRUVA_DEV__);
  if (!adapter) return;

  let settings = await loadSettings();

  const run = async (input: RunInput): Promise<RunOutcome> => {
    if (!isRemoteActive(settings)) return runLocal(input);
    let res: RemoteOptimizeResponse | undefined;
    try {
      res = await chrome.runtime.sendMessage({ type: "intruva:remote-optimize", request: toRequest(input) });
    } catch {
      res = undefined;
    }
    if (res?.ok) {
      return {
        ok: true,
        result: res.result,
        engine: "remote",
        notice: `Remote analysis: your text was sent to ${res.host}${
          res.redacted ? ` with ${res.redacted} detected secret${res.redacted === 1 ? "" : "s"}/personal data redacted first` : ""
        }.`,
      };
    }
    const local = runLocal(input);
    if (local.ok) local.notice = `Remote analysis failed (${res && !res.ok ? res.error : "no response"}). Showing the on-device result.`;
    return local;
  };

  const session = new PanelSession({
    composer: composerPort(adapter),
    run,
    copy: copyText,
    async openWebApp() {
      try {
        const res = await chrome.runtime.sendMessage({ type: "intruva:open-webapp" });
        return !!res?.ok;
      } catch {
        return false;
      }
    },
    targetModel: adapter.targetModel,
    defaultMode: settings.defaultMode,
  });

  const ui = new IntruvaUI({
    adapter,
    session,
    showLauncher: settings.showLauncher,
    remoteHost: remoteHost(settings),
    shadowMode: __INTRUVA_DEV__ ? "open" : "closed",
  }).mount();

  chrome.runtime.onMessage.addListener((msg: ContentMessage, _sender, sendResponse) => {
    if (msg?.type === "intruva:toggle") {
      ui.toggle();
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "intruva:ping") {
      const health = adapter.health(document);
      const res: PingResponse = { ok: true, site: adapter.id, siteName: adapter.name, health, panelOpen: ui.isOpen() };
      sendResponse(res);
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[SETTINGS_KEY]) return;
    settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
    ui.setShowLauncher(settings.showLauncher);
    ui.setRemoteHost(remoteHost(settings));
  });
}

void main();
