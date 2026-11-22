import type { TargetModel } from "@intruva/engine";

export type SiteId = "chatgpt" | "claude" | "gemini";

export interface LocationLike {
  hostname: string;
  pathname: string;
  port?: string;
}

/** How a composer was found (or why it wasn't). Never includes composer text. */
export interface ComposerHealth {
  ok: boolean;
  site: SiteId;
  siteName: string;
  /** Selector that matched, for diagnostics. */
  selector?: string;
  kind?: "contenteditable" | "textarea";
  reason?: string;
}

export interface WriteResult {
  ok: boolean;
  /** Which strategy ended up keeping the editor in sync. */
  method: "insertText" | "paste" | "dom" | "value" | "none";
  reason?: string;
}

/**
 * A site adapter knows how to find one site's chat composer and how to read
 * and write it without desynchronising the site's editor framework.
 *
 * Contract:
 *  - `findComposer` / `health` only locate the element; they never read text.
 *  - `readText` is called only after an explicit user action.
 *  - `writeText` never submits — it only replaces the composer contents.
 */
export interface SiteAdapter {
  id: SiteId;
  name: string;
  targetModel: TargetModel;
  hosts: string[];
  matches(loc: LocationLike): boolean;
  findComposer(doc?: Document): HTMLElement | null;
  /** The element the floating button anchors to (usually the composer's form/card). */
  anchorFor(composer: HTMLElement): HTMLElement;
  readText(el: HTMLElement): string;
  writeText(el: HTMLElement, text: string): Promise<WriteResult>;
  health(doc?: Document): ComposerHealth;
}

export interface AdapterSpec {
  id: SiteId;
  name: string;
  targetModel: TargetModel;
  hosts: string[];
  /** Ordered most-specific first. The first visible, editable match wins. */
  selectors: string[];
  /** `closest()` candidates for the anchor box, most specific first. */
  anchorSelectors: string[];
}
