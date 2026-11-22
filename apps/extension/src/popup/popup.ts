/**
 * Toolbar popup: is this tab a supported site, is the message box detected,
 * how to use Intruva, the privacy status, and a link to Options.
 * It asks the content script for a health "ping" — that never reads prompt text.
 */
import { ADAPTERS } from "../adapters";
import { COMMAND_TOGGLE, type PingResponse } from "../core/messages";
import { isRemoteActive, loadSettings } from "../core/settings";
import { h, logoMark } from "../shared/dom";

const SUPPORTED = ADAPTERS.map((a) => ({ name: a.name, host: a.hosts[0] }));

async function shortcutLabel(): Promise<string> {
  try {
    const cmds = await chrome.commands.getAll();
    return cmds.find((c) => c.name === COMMAND_TOGGLE)?.shortcut || "";
  } catch {
    return "";
  }
}

async function ping(tabId: number): Promise<PingResponse | null> {
  try {
    const res = (await chrome.tabs.sendMessage(tabId, { type: "intruva:ping" })) as PingResponse | undefined;
    return res?.ok ? res : null;
  } catch {
    return null;
  }
}

async function render() {
  const app = document.getElementById("app")!;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [settings, shortcut, pong] = await Promise.all([
    loadSettings(),
    shortcutLabel(),
    tab?.id !== undefined ? ping(tab.id) : Promise.resolve(null),
  ]);

  const siteCard = h("section", { class: "glass card stack", "aria-label": "This page" });
  if (pong) {
    const ok = pong.health.ok;
    siteCard.append(
      h(
        "div",
        { class: "status-line", style: `color: var(${ok ? "--in-ok" : "--in-warn"})`, "data-testid": "site-status" },
        h("span", { class: "dot" }),
        ok ? `${pong.siteName}: ready` : `${pong.siteName}: message box not found`,
      ),
      h(
        "div",
        { class: "muted" },
        ok
          ? "Type your prompt, then click the Intruva button next to the message box."
          : pong.health.reason ?? "Open a chat on this site, then try again.",
      ),
      h(
        "button",
        {
          class: "btn primary",
          type: "button",
          "data-testid": "open-here",
          onclick: async () => {
            if (tab?.id !== undefined) await chrome.tabs.sendMessage(tab.id, { type: "intruva:toggle" }).catch(() => {});
            window.close();
          },
        },
        pong.panelOpen ? "Close Intruva on this page" : "Open Intruva on this page",
      ),
    );
  } else {
    siteCard.append(
      h("div", { class: "status-line", style: "color: var(--in-fg-2)", "data-testid": "site-status" }, h("span", { class: "dot" }), "Not a supported page"),
      h(
        "div",
        { class: "muted" },
        "Intruva works inside these chat sites: ",
        ...SUPPORTED.flatMap((s, i) => [i ? ", " : "", h("b", null, s.name)]),
        ". If one is open in this tab, reload it once after installing.",
      ),
    );
  }

  const remote = isRemoteActive(settings);
  const privacy = h(
    "section",
    { class: "glass card stack", "aria-label": "Privacy" },
    h(
      "div",
      { class: "row" },
      h("span", { class: `pill ${remote ? "warn" : "ok"}`, "data-testid": "privacy-status" }, h("span", { class: "dot" }), remote ? "Remote analysis on" : "On-device only"),
    ),
    h(
      "div",
      { class: "faint" },
      remote
        ? `Prompts you analyse are sent to ${safeHost(settings.remote.apiUrl)} after detected secrets and personal data are redacted.`
        : "Analysis runs on a rule-based engine inside your browser. Nothing is sent, stored, or logged.",
    ),
  );

  const how = h(
    "section",
    { class: "glass card", "aria-label": "How to use" },
    h("b", null, "How to use"),
    h(
      "ol",
      { class: "steps" },
      h("li", null, "Write your prompt in the chat box."),
      h("li", null, "Click the Intruva button above the box", shortcut ? [" or press ", h("kbd", null, shortcut)] : null, "."),
      h("li", null, "Review gaps and risks, then Replace (or Copy). Revert undoes it."),
      h("li", null, "Press the site's own send button. Intruva never sends for you."),
    ),
    h(
      "div",
      { class: "faint", style: "margin-top:8px" },
      shortcut ? "Change the shortcut at " : "No shortcut set. Add one at ",
      h(
        "button",
        { class: "linkbtn", type: "button", onclick: () => void chrome.tabs.create({ url: "chrome://extensions/shortcuts" }) },
        "chrome://extensions/shortcuts",
      ),
      ".",
    ),
  );

  app.replaceChildren(
    h(
      "div",
      { class: "stack" },
      h("header", { class: "row" }, h("div", { class: "brand" }, logoMark(28), "Intruva")),
      siteCard,
      how,
      privacy,
      h(
        "div",
        { class: "links" },
        h("button", { class: "btn", type: "button", "data-testid": "open-options", onclick: () => void chrome.runtime.openOptionsPage() }, "Options & privacy"),
      ),
    ),
  );
}

function safeHost(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return "the configured API";
  }
}

void render();
