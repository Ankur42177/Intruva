import { defineAdapter } from "./dom";

/**
 * Claude (claude.ai). The composer is a ProseMirror (tiptap) editor:
 * `div.ProseMirror[contenteditable="true"]`, labelled "Write your prompt to
 * Claude", inside a `fieldset` card. Selectors could not be verified against a
 * logged-in session from CI (claude.ai redirects logged-out visitors to
 * /login), so the list is deliberately layered from specific to generic.
 */
export const claudeAdapter = defineAdapter({
  id: "claude",
  name: "Claude",
  targetModel: "claude",
  hosts: ["claude.ai"],
  selectors: [
    '[data-testid="chat-input"][contenteditable="true"]',
    '[data-testid="chat-input"] [contenteditable="true"]',
    'div.ProseMirror[contenteditable="true"][aria-label*="Claude" i]',
    '[aria-label*="prompt" i] div.ProseMirror[contenteditable="true"]',
    'fieldset div.ProseMirror[contenteditable="true"]',
    'div.ProseMirror[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    "fieldset textarea",
  ],
  anchorSelectors: ["fieldset", '[data-testid="chat-input-container"]', "form"],
});
