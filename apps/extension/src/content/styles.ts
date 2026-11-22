import { TOKENS_CSS } from "../shared/tokens";

/** Styles for the in-page UI. Scoped to the Shadow DOM, so nothing leaks either way. */
export const PANEL_CSS = `
:host {
  all: initial;
  ${TOKENS_CSS}
  position: fixed !important;
  inset: 0 auto auto 0 !important;
  width: 0 !important;
  height: 0 !important;
  z-index: 2147483646 !important;
  display: block !important;
  font: 13px/1.45 var(--in-font);
  color: var(--in-fg);
  color-scheme: dark;
}
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }

/* ------------------------------------------------------------ launcher */
.launcher {
  position: fixed; width: 34px; height: 34px; padding: 0; margin: 0;
  display: grid; place-items: center; cursor: pointer;
  border-radius: 12px; border: 1px solid var(--in-border);
  background: rgba(14, 17, 27, 0.72);
  box-shadow: var(--in-highlight), 0 6px 22px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  opacity: 0.82;
  transition: opacity 0.18s var(--in-ease), transform 0.18s var(--in-ease), border-color 0.18s var(--in-ease);
}
.launcher:hover, .launcher[aria-expanded="true"] { opacity: 1; border-color: rgba(157, 143, 255, 0.55); transform: translateY(-1px); }
.launcher:focus-visible { outline: none; opacity: 1; box-shadow: var(--in-focus); }
.launcher svg { width: 24px; height: 24px; display: block; }

/* --------------------------------------------------------------- panel */
.panel {
  position: fixed; width: min(408px, calc(100vw - 24px)); max-height: min(640px, calc(100vh - 24px));
  display: flex; flex-direction: column; overflow: hidden;
  border-radius: var(--in-radius-lg);
  background: var(--in-glass-panel);
  border: 1px solid var(--in-border);
  box-shadow: var(--in-highlight), 0 24px 70px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0,0,0,0.3);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  animation: in-pop 0.18s var(--in-ease);
}
.panel::before {
  content: ""; position: absolute; inset: 0 0 auto 0; height: 1px; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(188,178,255,0.55), rgba(92,225,230,0.45), transparent);
}
@keyframes in-pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: none; } }

.head { display: flex; align-items: center; gap: 10px; padding: 12px 12px 10px 14px; border-bottom: 1px solid var(--in-border); }
.head svg { width: 22px; height: 22px; flex: none; }
.title { font-weight: 650; font-size: 14px; letter-spacing: -0.01em; }
.sub { color: var(--in-fg-3); font-size: 11.5px; }
.grow { flex: 1; min-width: 0; }
.body { overflow: auto; padding: 12px 14px 4px; display: flex; flex-direction: column; gap: 12px; overscroll-behavior: contain; }
.foot { padding: 10px 14px 12px; border-top: 1px solid var(--in-border); display: flex; flex-direction: column; gap: 8px; }

.section-label { font-size: 11px; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; color: var(--in-fg-3); margin: 0 0 6px; }
.card { background: var(--in-glass); border: 1px solid var(--in-border); border-radius: 14px; padding: 10px 12px; box-shadow: var(--in-highlight); }
.muted { color: var(--in-fg-2); }
.faint { color: var(--in-fg-3); font-size: 11.5px; }
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.between { justify-content: space-between; }

.pill { display: inline-flex; align-items: center; gap: 5px; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; border: 1px solid var(--in-border); background: rgba(255,255,255,0.04); color: var(--in-fg-2); white-space: nowrap; }
.pill.ok { color: var(--in-ok); border-color: rgba(95,224,164,0.35); }
.pill.warn { color: var(--in-warn); border-color: rgba(243,197,106,0.35); }
.pill.risk { color: var(--in-risk); border-color: rgba(255,138,122,0.4); }
.pill.iris { color: #cfc8ff; border-color: rgba(157,143,255,0.4); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }

/* -------------------------------------------------------------- controls */
button { font: inherit; color: inherit; }
.btn {
  appearance: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 7px 12px; border-radius: 11px; font-weight: 600; font-size: 12.5px; color: var(--in-fg);
  background: var(--in-glass-strong); border: 1px solid var(--in-border); box-shadow: var(--in-highlight);
  transition: background 0.15s var(--in-ease), border-color 0.15s var(--in-ease), transform 0.15s var(--in-ease);
}
.btn:hover:not(:disabled) { background: rgba(255,255,255,0.13); border-color: var(--in-border-strong); }
.btn:active:not(:disabled) { transform: translateY(1px); }
.btn.primary { color: #0a0b12; background: var(--in-grad); border-color: transparent; }
.btn.primary:hover:not(:disabled) { filter: brightness(1.07); background: var(--in-grad); }
.btn.ghost { background: transparent; box-shadow: none; }
.btn.icon { padding: 5px; width: 28px; height: 28px; border-radius: 9px; }
.btn.small { padding: 4px 9px; font-size: 11.5px; border-radius: 9px; }
.btn:disabled { opacity: 0.42; cursor: not-allowed; }
:focus-visible { outline: none; box-shadow: var(--in-focus) !important; }

.seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 12px; background: rgba(5,6,11,0.55); border: 1px solid var(--in-border); }
.seg button { appearance: none; border: 0; background: transparent; padding: 4px 10px; border-radius: 9px; font-size: 12px; font-weight: 600; color: var(--in-fg-2); cursor: pointer; }
.seg button[aria-checked="true"] { color: var(--in-fg); background: rgba(157,143,255,0.22); box-shadow: inset 0 0 0 1px rgba(157,143,255,0.45); }
.seg button:hover:not([aria-checked="true"]) { color: var(--in-fg); }

select, input[type="text"] {
  font: inherit; font-size: 12.5px; color: var(--in-fg); background: rgba(5,6,11,0.6);
  border: 1px solid var(--in-border); border-radius: 10px; padding: 6px 9px; min-width: 0;
}
select { padding-right: 6px; }
select option { background: #0e111b; color: var(--in-fg); }
input[type="text"] { width: 100%; }
input[type="text"]::placeholder { color: var(--in-fg-3); }
select:focus-visible, input[type="text"]:focus-visible { border-color: var(--in-iris); }

/* ----------------------------------------------------------------- bits */
.scores { display: flex; gap: 8px; }
.score { flex: 1; padding: 8px 10px; }
.score b { font-size: 16px; font-variant-numeric: tabular-nums; }
.grad-text { background: var(--in-grad); -webkit-background-clip: text; background-clip: text; color: transparent; }

.gap { display: flex; flex-direction: column; gap: 6px; }
.gap + .gap { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--in-border); }
.gap-q { font-weight: 600; color: var(--in-fg); }
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
.chip { appearance: none; cursor: pointer; border: 1px solid var(--in-border); background: rgba(255,255,255,0.04); color: var(--in-fg-2); font-size: 11.5px; padding: 2px 8px; border-radius: 999px; }
.chip:hover { color: var(--in-fg); border-color: var(--in-border-strong); }

.finding { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; align-items: baseline; }
.finding + .finding { margin-top: 8px; }
.finding .dot { margin-top: 5px; }
.sev-critical, .sev-high { color: var(--in-risk); }
.sev-medium { color: var(--in-warn); }
.sev-low, .sev-info { color: var(--in-fg-3); }
code, .mono { font-family: var(--in-mono); font-size: 11.5px; }
.evidence { color: var(--in-fg-2); word-break: break-all; }

.preview {
  margin: 0; padding: 10px 12px; max-height: 220px; overflow: auto; white-space: pre-wrap; word-break: break-word;
  font: 11.5px/1.55 var(--in-mono); color: var(--in-fg); background: rgba(5,6,11,0.62);
  border: 1px solid var(--in-border); border-radius: 12px;
}
details summary { cursor: pointer; color: var(--in-fg-2); font-size: 12px; }
details ul { margin: 6px 0 0; padding-left: 18px; color: var(--in-fg-2); font-size: 12px; }

.actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.actions .btn.primary { grid-column: 1 / -1; padding: 9px 12px; font-size: 13px; }
.status { font-size: 12px; min-height: 0; }
.status.ok { color: var(--in-ok); }
.status.warn { color: var(--in-warn); }
.status.error { color: var(--in-risk); }
.status.info { color: var(--in-fg-2); }
.notice { font-size: 12px; padding: 8px 10px; border-radius: 12px; border: 1px solid rgba(243,197,106,0.35); color: var(--in-warn); background: rgba(243,197,106,0.06); }
.notice.remote { border-color: rgba(92,225,230,0.35); color: var(--in-aqua); background: rgba(92,225,230,0.06); }
.empty { padding: 18px 4px 10px; text-align: center; display: flex; flex-direction: column; gap: 10px; align-items: center; }
.empty .icon-ring { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; border: 1px solid var(--in-border); background: var(--in-glass); color: var(--in-warn); font-size: 20px; }
.spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.15); border-top-color: var(--in-aqua); animation: in-spin 0.8s linear infinite; }
@keyframes in-spin { to { transform: rotate(360deg); } }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;
