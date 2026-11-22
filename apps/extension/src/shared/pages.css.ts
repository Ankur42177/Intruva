import { PAGE_CSS } from "./tokens";

/** Extra layout for the popup and options pages, appended to PAGE_CSS into dist/ui.css. */
export const UI_CSS = `${PAGE_CSS}
body.popup { width: 340px; padding: 14px; }
body.options { min-height: 100vh; padding: 40px 20px 60px; }
.stack { display: flex; flex-direction: column; gap: 12px; }
.card { padding: 14px 16px; }
.status-line { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: none; }
ol.steps { margin: 6px 0 0; padding-left: 18px; color: var(--in-fg-2); }
ol.steps li + li { margin-top: 3px; }
.links { display: flex; gap: 8px; flex-wrap: wrap; }
.linkbtn { appearance: none; background: none; border: 0; padding: 0; font: inherit; color: var(--in-aqua); cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
.wrap { max-width: 720px; margin: 0 auto; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label, .legend { font-weight: 600; }
.hint { color: var(--in-fg-3); font-size: 12.5px; }
.error { color: var(--in-risk); font-size: 12.5px; }
.okmsg { color: var(--in-ok); font-size: 12.5px; }
fieldset { border: 0; padding: 0; margin: 0; }
.radios { display: flex; gap: 8px; flex-wrap: wrap; }
.radio { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--in-border); background: var(--in-glass); cursor: pointer; }
.radio:has(input:checked) { border-color: rgba(157,143,255,0.6); background: rgba(157,143,255,0.14); }
.radio input, .check input { accent-color: #9d8fff; }
.check { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; }
.switch { position: relative; display: inline-flex; align-items: center; gap: 10px; cursor: pointer; }
.switch input { appearance: none; width: 40px; height: 22px; border-radius: 999px; background: rgba(255,255,255,0.12); border: 1px solid var(--in-border); position: relative; cursor: pointer; transition: background 0.15s; margin: 0; flex: none; }
.switch input::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--in-fg); transition: transform 0.15s var(--in-ease); }
.switch input:checked { background: var(--in-iris); }
.switch input:checked::after { transform: translateX(18px); }
.switch input:disabled { opacity: 0.4; cursor: not-allowed; }
.switch input:focus-visible { box-shadow: var(--in-focus); }
.section-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--in-fg-3); font-weight: 650; }
.banner { padding: 10px 12px; border-radius: 12px; font-size: 13px; }
.banner.warn { border: 1px solid rgba(243,197,106,0.4); background: rgba(243,197,106,0.07); color: var(--in-warn); }
.banner.ok { border: 1px solid rgba(95,224,164,0.35); background: rgba(95,224,164,0.06); color: var(--in-ok); }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 560px) { .grid2 { grid-template-columns: 1fr; } }
`;
