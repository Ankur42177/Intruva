/**
 * Tiny DOM builder. Everything is created with createElement/createTextNode —
 * never innerHTML — so prompt text can't inject markup and pages that enforce
 * Trusted Types (e.g. Gemini) don't block the UI.
 */
type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === "class") {
        el.className = String(v);
      } else if (v === true) {
        el.setAttribute(k, "");
      } else {
        el.setAttribute(k, String(v));
      }
    }
  }
  append(el, children);
  return el;
}

function append(el: Node, children: (Child | Child[])[]) {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function s(tag: string, attrs: Record<string, string | number> = {}, ...children: SVGElement[]): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children) el.appendChild(c);
  return el;
}

let logoSeq = 0;

/**
 * Static Intruva mark (from apps/web LogoMark): glass body, iridescent rim,
 * the "V" (intent → structure) and the core dot. Gradient ids are unique per
 * instance so several marks can share a document.
 */
export function logoMark(size = 28): SVGElement {
  const id = `inv-logo-${++logoSeq}`;
  return s(
    "svg",
    { viewBox: "0 0 32 32", width: size, height: size, "aria-hidden": "true", focusable: "false" },
    s(
      "defs",
      {},
      s(
        "linearGradient",
        { id: `${id}-rim`, x1: 0, y1: 0, x2: 1, y2: 1 },
        s("stop", { offset: 0, "stop-color": "#d9d3ff" }),
        s("stop", { offset: 0.3, "stop-color": "#9d8fff" }),
        s("stop", { offset: 0.55, "stop-color": "#5ce1e6" }),
        s("stop", { offset: 0.8, "stop-color": "#ffab7d" }),
        s("stop", { offset: 1, "stop-color": "#d9d3ff" }),
      ),
      s(
        "linearGradient",
        { id: `${id}-v`, x1: 0, y1: 0, x2: 1, y2: 1 },
        s("stop", { offset: 0, "stop-color": "#eef0f7" }),
        s("stop", { offset: 0.5, "stop-color": "#bcb2ff" }),
        s("stop", { offset: 1, "stop-color": "#5ce1e6" }),
      ),
      s(
        "radialGradient",
        { id: `${id}-body`, cx: 0.32, cy: 0.22, r: 0.95 },
        s("stop", { offset: 0, "stop-color": "#ffffff", "stop-opacity": 0.28 }),
        s("stop", { offset: 0.45, "stop-color": "#9d8fff", "stop-opacity": 0.12 }),
        s("stop", { offset: 1, "stop-color": "#0a0c14", "stop-opacity": 0.9 }),
      ),
    ),
    s("rect", { x: 1, y: 1, width: 30, height: 30, rx: 10, fill: "#0a0c14" }),
    s("rect", { x: 1, y: 1, width: 30, height: 30, rx: 10, fill: `url(#${id}-body)` }),
    s("rect", { x: 1.7, y: 1.7, width: 28.6, height: 28.6, rx: 9.35, fill: "none", stroke: `url(#${id}-rim)`, "stroke-width": 1.4 }),
    s("path", {
      d: "M9.5 10 L16 22 L22.5 10",
      fill: "none",
      stroke: `url(#${id}-v)`,
      "stroke-width": 2.6,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
    s("circle", { cx: 16, cy: 9.6, r: 2.6, fill: "#5ce1e6", opacity: 0.35 }),
    s("circle", { cx: 16, cy: 9.6, r: 1.7, fill: "#eef0f7" }),
    s("path", { d: "M6 7.5 Q9 4.2 14 4", fill: "none", stroke: "#fff", "stroke-opacity": 0.45, "stroke-width": 1, "stroke-linecap": "round" }),
  );
}
