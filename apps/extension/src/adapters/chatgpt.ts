import { defineAdapter } from "./dom";

/**
 * ChatGPT (chatgpt.com, legacy chat.openai.com).
 *
 * Logged-in composer: ProseMirror `div#prompt-textarea.ProseMirror[contenteditable]`
 * inside `form[data-type="unified-composer"]` (a hidden `textarea[name=prompt-textarea]`
 * sits next to it and must be ignored). Logged-out composer (verified Nov 2026):
 * a plain `textarea#mobile-composer-prompt[name=prompt]` with aria-label
 * "Chat with ChatGPT".
 */
export const chatgptAdapter = defineAdapter({
  id: "chatgpt",
  name: "ChatGPT",
  targetModel: "chatgpt",
  hosts: ["chatgpt.com", "chat.openai.com"],
  selectors: [
    '#prompt-textarea[contenteditable="true"]',
    'div.ProseMirror#prompt-textarea',
    'form[data-type="unified-composer"] div.ProseMirror[contenteditable="true"]',
    'form div.ProseMirror[contenteditable="true"]',
    'textarea#prompt-textarea',
    'textarea#mobile-composer-prompt',
    'form textarea[name="prompt"]',
    'textarea[aria-label*="ChatGPT" i]',
    'main form [contenteditable="true"][role="textbox"]',
  ],
  anchorSelectors: ['form[data-type="unified-composer"]', "form", '[data-testid="composer"]'],
});
