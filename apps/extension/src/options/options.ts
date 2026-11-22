/**
 * Options: privacy-first settings. Default is on-device only. Remote analysis
 * stays disabled until an API URL and key are configured, asks for host
 * permission for exactly that origin, and says plainly that text leaves the
 * device (with detected secrets redacted first).
 */
import type { OptimizeMode } from "@intruva/engine";
import {
  DEFAULT_SETTINGS,
  DEFAULT_WEB_APP_URL,
  isRemoteConfigured,
  loadSettings,
  originPattern,
  saveSettings,
  validateHttpUrl,
  type Settings,
} from "../core/settings";
import { h, logoMark } from "../shared/dom";

let settings: Settings = structuredClone(DEFAULT_SETTINGS);
let flash = "";

async function persist(next: Settings, message = "Saved.") {
  settings = await saveSettings(next);
  flash = message;
  render();
}

function render() {
  const app = document.getElementById("app")!;
  // Re-rendering replaces the form; keep keyboard focus where it was.
  const focusedKey = (document.activeElement as HTMLElement | null)?.getAttribute("data-testid");
  const remoteReady = isRemoteConfigured(settings);

  const modeField = h(
    "fieldset",
    { class: "field" },
    h("legend", { class: "legend" }, "Default mode"),
    h(
      "div",
      { class: "radios" },
      ...(
        [
          ["quick", "Quick", "Structure + labelled assumptions"],
          ["deep", "Deep", "Asks the 1–3 questions that matter"],
          ["minimal", "Minimal", "Smallest possible change"],
        ] as const
      ).map(([id, label, hint]) => {
        const input = h("input", {
          type: "radio",
          name: "mode",
          value: id,
          "data-testid": `mode-${id}`,
          onchange: () => void persist({ ...settings, defaultMode: id as OptimizeMode }),
        });
        input.checked = settings.defaultMode === id;
        return h("label", { class: "radio", title: hint }, input, label);
      }),
    ),
  );

  const launcherToggle = h("input", {
    type: "checkbox",
    "data-testid": "show-launcher",
    onchange: (e: Event) => void persist({ ...settings, showLauncher: (e.target as HTMLInputElement).checked }),
  });
  launcherToggle.checked = settings.showLauncher;

  const webErr = h("div", { class: "error", role: "alert" });
  const webInput = h("input", { type: "url", id: "webapp", "data-testid": "webapp-url", spellcheck: "false", autocomplete: "off" });
  webInput.value = settings.webAppUrl;
  webInput.addEventListener("change", () => {
    const err = validateHttpUrl(webInput.value);
    webErr.textContent = err ?? "";
    if (!err) void persist({ ...settings, webAppUrl: webInput.value.trim() });
  });

  // ---------------------------------------------------------------- remote
  const apiUrl = h("input", { type: "url", id: "api-url", "data-testid": "api-url", placeholder: "https://api.example.com", spellcheck: "false", autocomplete: "off" });
  apiUrl.value = settings.remote.apiUrl;
  const apiKey = h("input", { type: "password", id: "api-key", "data-testid": "api-key", placeholder: "Your Intruva API key", autocomplete: "off" });
  apiKey.value = settings.remote.apiKey;
  const remoteErr = h("div", { class: "error", role: "alert", "data-testid": "remote-error" });

  const saveRemoteConfig = async () => {
    const url = apiUrl.value.trim();
    const err = url ? validateHttpUrl(url, { requireHttps: true }) : null;
    remoteErr.textContent = err ?? "";
    if (err) return;
    await persist({ ...settings, remote: { ...settings.remote, apiUrl: url, apiKey: apiKey.value.trim() } }, "Remote settings saved.");
  };
  apiUrl.addEventListener("change", () => void saveRemoteConfig());
  apiKey.addEventListener("change", () => void saveRemoteConfig());

  const remoteToggle = h("input", {
    type: "checkbox",
    role: "switch",
    "data-testid": "remote-toggle",
    "aria-describedby": "remote-explain",
    disabled: !remoteReady,
  });
  remoteToggle.checked = settings.remote.enabled && remoteReady;
  remoteToggle.addEventListener("change", async () => {
    if (!remoteToggle.checked) {
      const pattern = originPattern(settings.remote.apiUrl);
      if (pattern) await chrome.permissions.remove({ origins: [pattern] }).catch(() => false);
      await persist({ ...settings, remote: { ...settings.remote, enabled: false } }, "Remote analysis off. Everything stays on this device.");
      return;
    }
    const pattern = originPattern(settings.remote.apiUrl);
    let granted = false;
    try {
      granted = !!pattern && (await chrome.permissions.request({ origins: [pattern] }));
    } catch {
      granted = false;
    }
    if (!granted) {
      remoteToggle.checked = false;
      remoteErr.textContent = "Permission to contact the API host was not granted, so remote analysis stays off.";
      return;
    }
    await persist({ ...settings, remote: { ...settings.remote, enabled: true } }, "Remote analysis on.");
  });

  const clearKey = h(
    "button",
    {
      class: "btn",
      type: "button",
      "data-testid": "clear-remote",
      onclick: async () => {
        const pattern = originPattern(settings.remote.apiUrl);
        if (pattern) await chrome.permissions.remove({ origins: [pattern] }).catch(() => false);
        await persist({ ...settings, remote: { enabled: false, apiUrl: "", apiKey: "" } }, "Remote settings cleared.");
      },
    },
    "Clear API settings",
  );

  const remoteOn = settings.remote.enabled && remoteReady;

  app.replaceChildren(
    h(
      "div",
      { class: "wrap stack" },
      h("header", { class: "row", style: "justify-content: space-between" }, h("div", { class: "brand" }, logoMark(30), "Intruva options"), h("span", { class: "okmsg", role: "status", "data-testid": "flash" }, flash)),

      h(
        "section",
        { class: "glass card stack", "aria-labelledby": "privacy-h" },
        h("h2", { class: "section-title", id: "privacy-h" }, "Privacy"),
        h(
          "div",
          { class: `banner ${remoteOn ? "warn" : "ok"}`, "data-testid": "privacy-banner" },
          remoteOn
            ? `Remote analysis is ON. Prompts you analyse leave this device and are sent to ${new URL(settings.remote.apiUrl).host}. Detected secrets and personal data are redacted before sending.`
            : "On-device only. Intruva analyses prompts with a rule-based engine inside your browser. Nothing is sent anywhere.",
        ),
        h(
          "ul",
          { class: "muted", style: "margin:0; padding-left:18px" },
          h("li", null, "Intruva reads the message box only when you click its button, press the shortcut, or use Open in the popup."),
          h("li", null, "It never reads your chat history or other page content, and never presses send."),
          h("li", null, "Prompts are never stored. Only these settings are saved, in this browser."),
          h("li", null, "No analytics, no telemetry, no logging."),
        ),
      ),

      h(
        "section",
        { class: "glass card stack", "aria-labelledby": "general-h" },
        h("h2", { class: "section-title", id: "general-h" }, "General"),
        modeField,
        h(
          "label",
          { class: "check" },
          launcherToggle,
          h("span", null, h("b", null, "Show the floating Intruva button"), h("div", { class: "hint" }, "Turn off to use only the keyboard shortcut or the toolbar popup.")),
        ),
        h(
          "div",
          { class: "field" },
          h("label", { for: "webapp" }, "Web app URL (for Full analysis)"),
          webInput,
          h("div", { class: "hint" }, `Default ${DEFAULT_WEB_APP_URL}. Your prompt is copied to the clipboard, never put in this URL.`),
          webErr,
        ),
      ),

      h(
        "section",
        { class: "glass card stack", "aria-labelledby": "remote-h" },
        h("h2", { class: "section-title", id: "remote-h" }, "Remote analysis (optional)"),
        h(
          "p",
          { class: "muted", id: "remote-explain", style: "margin:0" },
          "Off by default. When an Intruva API is available you can send prompts to it for deeper analysis. Before anything is sent, secrets and personal data detected on-device are replaced with placeholders. ",
          remoteReady ? "" : "Add an https API URL and an API key to enable the switch.",
        ),
        h(
          "div",
          { class: "grid2" },
          h("div", { class: "field" }, h("label", { for: "api-url" }, "API URL"), apiUrl),
          h("div", { class: "field" }, h("label", { for: "api-key" }, "API key"), apiKey, h("div", { class: "hint" }, "Stored unencrypted in this browser's extension storage.")),
        ),
        remoteErr,
        h(
          "div",
          { class: "row", style: "justify-content: space-between" },
          h("label", { class: "switch" }, remoteToggle, h("span", null, remoteOn ? "Remote analysis on" : "Remote analysis off")),
          clearKey,
        ),
      ),
      h("p", { class: "faint" }, "Intruva extension · rule-based engine, runs on your device."),
    ),
  );
  if (focusedKey) app.querySelector<HTMLElement>(`[data-testid="${focusedKey}"]`)?.focus();
}

void loadSettings().then((s) => {
  settings = s;
  render();
});
