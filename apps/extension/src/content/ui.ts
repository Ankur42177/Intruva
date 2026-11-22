/**
 * In-page UI shell: a Shadow DOM host with the floating launcher and the
 * panel dialog. Handles placement near the composer, focus trapping, Esc,
 * and keeping keystrokes inside the panel from reaching the site's handlers.
 *
 * Locating the composer (to place the button) never reads its text.
 */
import type { SiteAdapter } from "../adapters/types";
import type { PanelSession } from "../core/session";
import { h, logoMark } from "../shared/dom";
import { renderPanel } from "./panel";
import { PANEL_CSS } from "./styles";

export interface UIOptions {
  adapter: SiteAdapter;
  session: PanelSession;
  showLauncher: boolean;
  remoteHost: string | null;
  shadowMode: ShadowRootMode;
  doc?: Document;
  /** Reposition poll interval; 0 disables polling (tests). */
  pollMs?: number;
}

const LAUNCHER = 34;
const GAP = 8;
const EDGE = 12;
const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"]), summary, a[href]';

export const HOST_TAG = "intruva-root";

export class IntruvaUI {
  readonly host: HTMLElement;
  readonly root: ShadowRoot;
  readonly launcher: HTMLButtonElement;
  readonly panel: HTMLDivElement;
  private open_ = false;
  private showLauncher: boolean;
  private composerFound = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private raf = 0;
  private unsub: (() => void) | null = null;
  private readonly doc: Document;
  private remoteHost: string | null;

  constructor(private opts: UIOptions) {
    this.doc = opts.doc ?? document;
    this.showLauncher = opts.showLauncher;
    this.remoteHost = opts.remoteHost;
    this.host = this.doc.createElement(HOST_TAG);
    this.host.setAttribute("data-intruva-host", "");
    this.root = this.host.attachShadow({ mode: opts.shadowMode });
    this.adoptStyles();

    this.launcher = h(
      "button",
      {
        class: "launcher",
        type: "button",
        "data-intruva": "launcher",
        "aria-label": "Open Intruva: optimize and check this prompt",
        "aria-haspopup": "dialog",
        "aria-expanded": "false",
        title: "Intruva: optimize & check this prompt",
        hidden: true,
      },
      logoMark(24),
    );
    this.launcher.addEventListener("click", () => this.toggle());

    this.panel = h("div", {
      class: "panel",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "intruva-title",
      "data-intruva": "panel",
      hidden: true,
    });
    this.root.append(this.launcher, this.panel);
    this.root.addEventListener("keydown", (e) => this.onKeydown(e as KeyboardEvent));
    // Keystrokes typed into the panel must not trigger the site's shortcuts
    // (e.g. "start typing to focus the composer").
    for (const type of ["keydown", "keyup", "keypress"]) {
      this.host.addEventListener(type, (e) => e.stopPropagation());
    }
  }

  private adoptStyles() {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(PANEL_CSS);
      this.root.adoptedStyleSheets = [sheet];
    } catch {
      const style = this.doc.createElement("style");
      style.textContent = PANEL_CSS;
      this.root.append(style);
    }
  }

  mount(): this {
    this.doc.documentElement.appendChild(this.host);
    this.unsub = this.opts.session.subscribe(() => this.render());
    const view = this.doc.defaultView;
    view?.addEventListener("resize", this.schedule, { passive: true });
    view?.addEventListener("scroll", this.schedule, { passive: true, capture: true });
    if (this.opts.pollMs !== 0) this.timer = setInterval(this.schedule, this.opts.pollMs ?? 1200);
    this.reposition();
    return this;
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    this.unsub?.();
    const view = this.doc.defaultView;
    view?.removeEventListener("resize", this.schedule);
    view?.removeEventListener("scroll", this.schedule, { capture: true });
    this.host.remove();
  }

  isOpen() {
    return this.open_;
  }

  setShowLauncher(v: boolean) {
    this.showLauncher = v;
    this.reposition();
  }

  setRemoteHost(host: string | null) {
    this.remoteHost = host;
    if (this.open_) this.render();
  }

  toggle() {
    if (this.open_) this.close();
    else this.open();
  }

  open() {
    if (this.open_) return;
    // Re-attach if a site re-render removed our host.
    if (!this.host.isConnected) this.doc.documentElement.appendChild(this.host);
    this.open_ = true;
    this.panel.hidden = false;
    this.launcher.setAttribute("aria-expanded", "true");
    this.render();
    this.reposition();
    this.focusFirst();
    const initial = this.root.activeElement;
    void this.opts.session.start().then(() => {
      // Move focus to the primary action unless the user already moved it.
      const now = this.root.activeElement;
      if (this.open_ && (!now || now === initial || now.getAttribute("data-key") === "close")) this.focusFirst();
    });
  }

  close({ restoreFocus = true } = {}) {
    if (!this.open_) return;
    this.open_ = false;
    this.panel.hidden = true;
    this.panel.replaceChildren();
    this.launcher.setAttribute("aria-expanded", "false");
    this.opts.session.clearStatus();
    if (!restoreFocus) return;
    const composer = this.opts.adapter.findComposer(this.doc);
    if (composer) composer.focus();
    else if (!this.launcher.hidden) this.launcher.focus();
  }

  /* --------------------------------------------------------- rendering */

  render() {
    if (!this.open_) return;
    const active = this.root.activeElement as HTMLElement | null;
    const key = active?.getAttribute("data-key");
    const body = this.panel.querySelector(".body");
    const scroll = body?.scrollTop ?? 0;
    this.panel.replaceChildren(
      ...renderPanel(this.opts.session, {
        siteName: this.opts.adapter.name,
        remoteHost: this.remoteHost,
        onClose: () => this.close(),
      }),
    );
    const newBody = this.panel.querySelector(".body");
    if (newBody) newBody.scrollTop = scroll;
    if (key) {
      const again = this.panel.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
      if (again && !(again as HTMLButtonElement).disabled) again.focus();
      else this.focusFirst();
    }
    this.reposition();
  }

  private focusables(): HTMLElement[] {
    return [...this.panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest("[hidden]"));
  }

  private focusFirst() {
    const list = this.focusables();
    // Prefer the primary action, else the first control.
    const primary = list.find((el) => el.getAttribute("data-key") === "replace");
    (primary ?? list[0])?.focus();
  }

  private onKeydown(e: KeyboardEvent) {
    if (!this.open_) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key !== "Tab") return;
    const list = this.focusables();
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    const active = this.root.activeElement as HTMLElement | null;
    const inside = !!active && this.panel.contains(active);
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }

  /* --------------------------------------------------------- placement */

  private schedule = () => {
    if (this.raf) return;
    const view = this.doc.defaultView;
    if (!view?.requestAnimationFrame) {
      this.reposition();
      return;
    }
    this.raf = view.requestAnimationFrame(() => {
      this.raf = 0;
      this.reposition();
    });
  };

  reposition() {
    const view = this.doc.defaultView;
    const vw = view?.innerWidth ?? 1024;
    const vh = view?.innerHeight ?? 768;
    const composer = this.opts.adapter.findComposer(this.doc);
    this.composerFound = !!composer;
    let lx = vw - LAUNCHER - 24;
    let ly = vh - LAUNCHER - 120;
    if (composer) {
      const r = this.opts.adapter.anchorFor(composer).getBoundingClientRect();
      if (r.width > 0 || r.height > 0) {
        lx = r.right - LAUNCHER - 6;
        ly = r.top - LAUNCHER - GAP;
        if (ly < EDGE) ly = r.top + GAP; // no room above: tuck inside the top-right corner
      }
    }
    lx = clamp(lx, EDGE, vw - LAUNCHER - EDGE);
    ly = clamp(ly, EDGE, vh - LAUNCHER - EDGE);
    this.launcher.hidden = !this.showLauncher || (!this.composerFound && !this.open_);
    this.launcher.style.left = `${Math.round(lx)}px`;
    this.launcher.style.top = `${Math.round(ly)}px`;

    if (!this.open_) return;
    const pw = Math.min(408, vw - 2 * EDGE);
    const ph = Math.min(this.panel.offsetHeight || 560, vh - 2 * EDGE);
    let px = lx + LAUNCHER - pw;
    let py = ly - ph - GAP;
    if (py < EDGE) py = ly + LAUNCHER + GAP;
    if (py + ph > vh - EDGE) py = vh - EDGE - ph;
    px = clamp(px, EDGE, vw - pw - EDGE);
    py = clamp(py, EDGE, Math.max(EDGE, vh - ph - EDGE));
    this.panel.style.left = `${Math.round(px)}px`;
    this.panel.style.top = `${Math.round(py)}px`;
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
