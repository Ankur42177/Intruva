/**
 * Intruva liquid-glass design tokens (mirrors apps/web DESIGN_SYSTEM.md).
 * Shared by the in-page panel (inside Shadow DOM), the popup, and options.
 */
export const TOKENS_CSS = `
  --in-bg: #05060b;
  --in-bg-2: #0e111b;
  --in-glass: rgba(255, 255, 255, 0.06);
  --in-glass-strong: rgba(255, 255, 255, 0.09);
  --in-glass-panel: rgba(14, 17, 27, 0.82);
  --in-border: rgba(255, 255, 255, 0.1);
  --in-border-strong: rgba(255, 255, 255, 0.18);
  --in-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.12);
  --in-grad: linear-gradient(135deg, #bcb2ff 0%, #9d8fff 45%, #5ce1e6 100%);
  --in-iris: #9d8fff;
  --in-aqua: #5ce1e6;
  --in-fg: #eef0f7;
  --in-fg-2: #b4b8cc;
  --in-fg-3: #8a8fa8;
  --in-ok: #5fe0a4;
  --in-warn: #f3c56a;
  --in-risk: #ff8a7a;
  --in-radius: 16px;
  --in-radius-lg: 20px;
  --in-radius-sm: 10px;
  --in-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --in-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --in-focus: 0 0 0 2px #05060b, 0 0 0 4px #9d8fff;
  --in-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
`;

/** Base styles for the popup and options pages (regular documents, not Shadow DOM). */
export const PAGE_CSS = `
:root { ${TOKENS_CSS} color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  background: radial-gradient(120% 80% at 10% -10%, rgba(157,143,255,0.18), transparent 60%),
              radial-gradient(90% 70% at 110% 0%, rgba(92,225,230,0.12), transparent 55%),
              var(--in-bg);
  color: var(--in-fg);
  font: 14px/1.5 var(--in-font);
  -webkit-font-smoothing: antialiased;
}
a { color: var(--in-aqua); }
h1, h2, h3 { margin: 0; letter-spacing: -0.01em; }
.glass {
  background: var(--in-glass);
  border: 1px solid var(--in-border);
  border-radius: var(--in-radius);
  box-shadow: var(--in-highlight), 0 12px 40px rgba(0,0,0,0.35);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
}
.muted { color: var(--in-fg-2); }
.faint { color: var(--in-fg-3); font-size: 12px; }
.row { display: flex; align-items: center; gap: 10px; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 16px; }
.brand svg { width: 28px; height: 28px; }
.pill {
  display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px;
  border-radius: 999px; font-size: 12px; border: 1px solid var(--in-border); background: var(--in-glass);
}
.pill.ok { color: var(--in-ok); border-color: rgba(95,224,164,0.35); }
.pill.warn { color: var(--in-warn); border-color: rgba(243,197,106,0.35); }
.pill.risk { color: var(--in-risk); border-color: rgba(255,138,122,0.35); }
.btn {
  appearance: none; font: inherit; font-weight: 600; font-size: 13px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 14px; border-radius: 12px; color: var(--in-fg);
  background: var(--in-glass-strong); border: 1px solid var(--in-border); box-shadow: var(--in-highlight);
  transition: background 0.15s var(--in-ease), border-color 0.15s var(--in-ease), transform 0.15s var(--in-ease);
}
.btn:hover { background: rgba(255,255,255,0.13); border-color: var(--in-border-strong); }
.btn:active { transform: translateY(1px); }
.btn.primary { color: #0a0b12; background: var(--in-grad); border-color: transparent; }
.btn.primary:hover { filter: brightness(1.06); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
:focus-visible { outline: none; box-shadow: var(--in-focus); border-radius: 8px; }
.btn:focus-visible { box-shadow: var(--in-focus); border-radius: 12px; }
input[type=text], input[type=url], input[type=password] {
  width: 100%; font: inherit; color: var(--in-fg); padding: 9px 12px; border-radius: 12px;
  background: rgba(5,6,11,0.6); border: 1px solid var(--in-border);
}
input[type=text]:focus-visible, input[type=url]:focus-visible, input[type=password]:focus-visible {
  border-color: var(--in-iris); box-shadow: 0 0 0 3px rgba(157,143,255,0.25);
}
kbd {
  font: 12px var(--in-mono); padding: 1px 6px; border-radius: 6px;
  border: 1px solid var(--in-border-strong); background: rgba(255,255,255,0.06);
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; }
}
`;
