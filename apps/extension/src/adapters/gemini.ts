import { defineAdapter } from "./dom";

/**
 * Gemini (gemini.google.com). The composer is a Quill editor:
 * `rich-textarea > div.ql-editor.textarea[contenteditable][role=textbox]`,
 * aria-label "Enter a prompt for Gemini" (verified Nov 2026, logged out).
 * Quill also renders a hidden `div.ql-clipboard[contenteditable]` which must
 * never be picked.
 */
export const geminiAdapter = defineAdapter({
  id: "gemini",
  name: "Gemini",
  targetModel: "gemini",
  hosts: ["gemini.google.com"],
  selectors: [
    'rich-textarea div.ql-editor[contenteditable="true"]',
    'div.ql-editor.textarea[contenteditable="true"]',
    'div.ql-editor[contenteditable="true"]:not(.ql-clipboard)',
    '[contenteditable="true"][role="textbox"][aria-label*="Gemini" i]',
    '[contenteditable="true"][aria-label*="prompt" i]:not(.ql-clipboard)',
    'rich-textarea [contenteditable="true"]:not(.ql-clipboard)',
  ],
  anchorSelectors: [".text-input-field", "input-area-v2", ".input-area", "rich-textarea"],
});
