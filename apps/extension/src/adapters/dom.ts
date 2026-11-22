/**
 * DOM helpers shared by every site adapter: locating an editable composer,
 * serialising rich-editor DOM to plain text, and writing text back in a way
 * that keeps ProseMirror / Quill / React state in sync.
 */
import type { AdapterSpec, ComposerHealth, LocationLike, SiteAdapter, WriteResult } from "./types";

const BLOCK_TAGS = new Set([
  "P", "DIV", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6",
  "PRE", "BLOCKQUOTE", "TABLE", "TR", "SECTION", "ARTICLE", "HR",
]);

export function isTextArea(el: Element): el is HTMLTextAreaElement {
  return el.tagName === "TEXTAREA";
}

export function isEditable(el: Element): boolean {
  if (isTextArea(el)) return !el.disabled && !el.readOnly;
  const ce = el.getAttribute("contenteditable");
  return ce === "" || ce === "true" || ce === "plaintext-only";
}

/** Cheap visibility test that works in real Chrome and in DOM test environments. */
export function isVisible(el: Element): boolean {
  if (el.closest("[hidden], [aria-hidden='true'], template")) return false;
  if ((el as HTMLInputElement).type === "hidden") return false;
  const view = el.ownerDocument.defaultView;
  for (let n: Element | null = el; n; n = n.parentElement) {
    const cs = view?.getComputedStyle(n);
    if (cs && (cs.display === "none" || cs.visibility === "hidden")) return false;
  }
  // In a real browser, a laid-out element has client rects. DOM test
  // environments don't do layout, so only apply this check when layout exists.
  const docHasLayout = el.ownerDocument.documentElement.getBoundingClientRect().width > 0;
  if (docHasLayout) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
  }
  return true;
}

export function findComposer(doc: Document, selectors: string[]): { el: HTMLElement; selector: string } | null {
  for (const selector of selectors) {
    let nodes: HTMLElement[];
    try {
      nodes = [...doc.querySelectorAll<HTMLElement>(selector)];
    } catch {
      continue; // a selector unsupported by this engine must never break the page
    }
    const usable = nodes.filter((n) => isEditable(n) && isVisible(n));
    if (!usable.length) continue;
    const active = doc.activeElement;
    const focused = usable.find((n) => n === active || (active && n.contains(active)));
    return { el: focused ?? usable[0], selector };
  }
  return null;
}

/* ------------------------------------------------------------------ reading */

function isTrailingBreak(br: Element): boolean {
  if (br.classList.contains("ProseMirror-trailingBreak")) return true;
  for (let n = br.nextSibling; n; n = n.nextSibling) {
    if (n.nodeType === 3 && !(n as Text).data.replace(/[​﻿]/g, "")) continue;
    if (n.nodeType === 1 && (n as Element).tagName === "BR") return false;
    if (n.nodeType === 1 && !(n as Element).textContent) continue;
    return false;
  }
  return true;
}

/**
 * Serialise a contenteditable editor to plain text: one line per block
 * (paragraph), `<br>` as a newline, empty paragraphs as empty lines.
 * Deliberately not `innerText`, which adds layout-dependent blank lines.
 */
export function serializeEditable(root: Element): string {
  const lines: string[] = [];
  let cur: string | null = null;
  const flush = () => {
    if (cur !== null) {
      lines.push(cur);
      cur = null;
    }
  };
  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const t = (child as Text).data.replace(/[​﻿]/g, "").replace(/ /g, " ");
        if (t) cur = (cur ?? "") + t;
        continue;
      }
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      if (el.tagName === "BR") {
        if (isTrailingBreak(el)) cur = cur ?? "";
        else {
          lines.push(cur ?? "");
          cur = "";
        }
        continue;
      }
      if (el.getAttribute("contenteditable") === "false" && el.classList.contains("ProseMirror-widget")) continue;
      if (BLOCK_TAGS.has(el.tagName)) {
        flush();
        walk(el);
        flush();
      } else {
        walk(el);
      }
    }
  };
  walk(root);
  flush();
  return lines.join("\n");
}

export function readComposerText(el: HTMLElement): string {
  return isTextArea(el) ? el.value : serializeEditable(el);
}

/** Whitespace-insensitive comparison used to verify writes. */
export function normalizeText(s: string): string {
  return s.replace(/[​﻿]/g, "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

export function sameText(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}

/* ------------------------------------------------------------------ writing */

const settle = (ms = 40) => new Promise<void>((r) => setTimeout(r, ms));

function selectAllIn(el: HTMLElement) {
  const doc = el.ownerDocument;
  const sel = doc.defaultView?.getSelection();
  if (!sel) return;
  const range = doc.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

function caretToEnd(el: HTMLElement) {
  try {
    if (isTextArea(el)) {
      el.setSelectionRange(el.value.length, el.value.length);
      return;
    }
    const doc = el.ownerDocument;
    const sel = doc.defaultView?.getSelection();
    if (!sel) return;
    const range = doc.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    /* caret placement is cosmetic */
  }
}

function execInsertText(doc: Document, text: string): boolean {
  try {
    // Deprecated but still the one API that goes through the browser's own
    // editing pipeline, so rich editors see a normal `beforeinput`/`input`.
    return doc.execCommand("insertText", false, text);
  } catch {
    return false;
  }
}

async function writeTextArea(el: HTMLTextAreaElement, text: string): Promise<WriteResult> {
  const doc = el.ownerDocument;
  el.focus();
  el.select();
  if (execInsertText(doc, text)) {
    await settle(0);
    if (el.value === text) {
      caretToEnd(el);
      return { ok: true, method: "insertText" };
    }
  }
  // React-controlled textareas ignore `el.value = …`; use the native setter
  // so React's value tracker sees a change, then announce it.
  const view = doc.defaultView;
  const proto = view?.HTMLTextAreaElement?.prototype ?? HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, text);
  else el.value = text;
  const InputEv = view?.InputEvent ?? InputEvent;
  el.dispatchEvent(new InputEv("input", { bubbles: true, inputType: "insertReplacementText", data: text }));
  el.dispatchEvent(new (view?.Event ?? Event)("change", { bubbles: true }));
  await settle(0);
  caretToEnd(el);
  return el.value === text
    ? { ok: true, method: "value" }
    : { ok: false, method: "none", reason: "The composer rejected the new text." };
}

async function writeRich(el: HTMLElement, text: string): Promise<WriteResult> {
  const doc = el.ownerDocument;
  const view = doc.defaultView;
  el.focus();

  // 1) Native editing pipeline — best for ProseMirror, Quill, Lexical, Slate.
  selectAllIn(el);
  if (execInsertText(doc, text)) {
    await settle();
    if (sameText(serializeEditable(el), text)) {
      caretToEnd(el);
      return { ok: true, method: "insertText" };
    }
  }

  // 2) Synthetic paste — editors parse clipboardData into their own model.
  try {
    selectAllIn(el);
    const DT = view?.DataTransfer;
    const CE = view?.ClipboardEvent;
    if (DT && CE) {
      const dt = new DT();
      dt.setData("text/plain", text);
      el.dispatchEvent(new CE("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
      await settle();
      if (sameText(serializeEditable(el), text)) {
        caretToEnd(el);
        return { ok: true, method: "paste" };
      }
    }
  } catch {
    /* fall through */
  }

  // 3) Last resort: write paragraphs directly and announce an input event.
  const paras = text.split("\n").map((line) => {
    const p = doc.createElement("p");
    if (line) p.textContent = line;
    else p.appendChild(doc.createElement("br"));
    return p;
  });
  el.replaceChildren(...paras);
  const InputEv = view?.InputEvent ?? InputEvent;
  el.dispatchEvent(new InputEv("input", { bubbles: true, inputType: "insertReplacementText", data: text }));
  await settle();
  if (sameText(serializeEditable(el), text)) {
    caretToEnd(el);
    return { ok: true, method: "dom" };
  }
  return { ok: false, method: "none", reason: "The site's editor didn't accept the new text." };
}

export function writeComposerText(el: HTMLElement, text: string): Promise<WriteResult> {
  return isTextArea(el) ? writeTextArea(el, text) : writeRich(el, text);
}

/* ----------------------------------------------------------- adapter factory */

export function defineAdapter(spec: AdapterSpec): SiteAdapter {
  const hostOk = (h: string) => spec.hosts.some((host) => h === host || h.endsWith(`.${host}`));
  return {
    id: spec.id,
    name: spec.name,
    targetModel: spec.targetModel,
    hosts: spec.hosts,
    matches: (loc: LocationLike) => hostOk(loc.hostname),
    findComposer: (doc = document) => findComposer(doc, spec.selectors)?.el ?? null,
    anchorFor(composer: HTMLElement) {
      for (const sel of spec.anchorSelectors) {
        try {
          const a = composer.closest<HTMLElement>(sel);
          if (a) return a;
        } catch {
          /* ignore invalid selector */
        }
      }
      return composer;
    },
    readText: readComposerText,
    writeText: writeComposerText,
    health(doc = document): ComposerHealth {
      const hit = findComposer(doc, spec.selectors);
      if (!hit) {
        return {
          ok: false,
          site: spec.id,
          siteName: spec.name,
          reason: `Couldn't find the ${spec.name} message box on this page. Open a chat, or reload if ${spec.name} changed its layout.`,
        };
      }
      return {
        ok: true,
        site: spec.id,
        siteName: spec.name,
        selector: hit.selector,
        kind: isTextArea(hit.el) ? "textarea" : "contenteditable",
      };
    },
  };
}
