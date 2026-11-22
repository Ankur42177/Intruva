/**
 * Panel session: all of the panel's behaviour, with no DOM. The view renders
 * `state` and calls these methods; tests drive it with a fake composer.
 *
 * Invariants:
 *  - The composer is read only from `start()` / `reanalyze()` / just before a
 *    write — each of which is the direct result of a user action.
 *  - Nothing here ever submits. Writes only replace composer text.
 *  - After any Replace, Revert restores what the composer held before
 *    Intruva wrote to it.
 */
import {
  applyRedactions,
  scanPrompt,
  type MissingContext,
  type OptimizeMode,
  type OptimizeResult,
  type SecurityFinding,
  type TargetModel,
  type TaskSelection,
} from "@intruva/engine";
import type { WriteResult } from "../adapters/types";
import { sameText } from "../adapters/dom";
import type { RunInput, RunOutcome } from "./engine";

export interface ComposerPort {
  /** Locate the composer; `reason` explains a miss. Does not read text. */
  locate(): { ok: true } | { ok: false; reason: string };
  /** Read the composer text, or null if it has disappeared. */
  read(): string | null;
  write(text: string): Promise<WriteResult>;
}

export interface SessionDeps {
  composer: ComposerPort;
  run(input: RunInput): Promise<RunOutcome>;
  copy(text: string): Promise<boolean>;
  openWebApp(): Promise<boolean>;
  targetModel: TargetModel;
  defaultMode?: OptimizeMode;
}

export type Phase = "idle" | "no-composer" | "invalid" | "running" | "ready";

export interface StatusLine {
  kind: "ok" | "info" | "warn" | "error";
  text: string;
}

export interface SessionState {
  phase: Phase;
  /** Explains no-composer / invalid phases. */
  message: string;
  /** Composer text captured when the user asked for analysis. */
  original: string;
  mode: OptimizeMode;
  taskType: TaskSelection;
  answers: Record<string, string>;
  /** Redaction preview on: secrets/PII in the original are replaced before optimizing. */
  redact: boolean;
  /** Findings in the original text (masked evidence only is ever rendered). */
  originalFindings: SecurityFinding[];
  result: OptimizeResult | null;
  engine: "local" | "remote";
  notice: string;
  /** What Replace / Copy will use. */
  preview: string;
  /** What the composer held right before Intruva last wrote to it. */
  revertTo: string | null;
  /** What Intruva last wrote. */
  written: string | null;
  revertConfirm: boolean;
  status: StatusLine | null;
  busy: boolean;
}

export class PanelSession {
  state: SessionState;
  private listeners = new Set<(s: SessionState) => void>();
  private runSeq = 0;

  constructor(private deps: SessionDeps) {
    this.state = {
      phase: "idle",
      message: "",
      original: "",
      mode: deps.defaultMode ?? "quick",
      taskType: "auto",
      answers: {},
      redact: false,
      originalFindings: [],
      result: null,
      engine: "local",
      notice: "",
      preview: "",
      revertTo: null,
      written: null,
      revertConfirm: false,
      status: null,
      busy: false,
    };
  }

  subscribe(fn: (s: SessionState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<SessionState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  /* ------------------------------------------------------------ derived */

  /** Top context gaps: Deep mode's ranked questions, otherwise the top 3 missing items. */
  gaps(): MissingContext[] {
    const a = this.state.result?.analysis;
    if (!a) return [];
    const list = a.questions.length ? a.questions : a.missing_context;
    return list.slice(0, 3);
  }

  redactableCount(): number {
    return this.state.originalFindings.filter((f) => f.redaction).length;
  }

  canRevert(): boolean {
    return this.state.revertTo !== null;
  }

  /* ------------------------------------------------------------ actions */

  /** Panel opened (button click or shortcut): read the composer and analyse. */
  async start(): Promise<void> {
    const located = this.deps.composer.locate();
    if (!located.ok) {
      this.set({ phase: "no-composer", message: located.reason, status: null });
      return;
    }
    const text = this.deps.composer.read();
    if (text === null) {
      this.set({ phase: "no-composer", message: "The message box disappeared. Click Try again.", status: null });
      return;
    }
    // If the composer still shows what we wrote, keep analysing the user's original.
    if (this.state.written !== null && sameText(text, this.state.written) && this.state.original) {
      await this.analyze();
      return;
    }
    if (!text.trim()) {
      this.set({
        phase: "invalid",
        message: "The message box is empty. Type your prompt there first, then open Intruva.",
        original: "",
        result: null,
        status: null,
      });
      return;
    }
    this.set({ original: text, originalFindings: scanPrompt(text).findings, answers: {}, redact: false, status: null });
    await this.analyze();
  }

  /** Re-read the composer and analyse again (e.g. after the user edited it). */
  reanalyze(): Promise<void> {
    return this.start();
  }

  private textForRun(): string {
    const { original, redact, originalFindings } = this.state;
    return redact ? applyRedactions(original, originalFindings.filter((f) => f.redaction)) : original;
  }

  async analyze(): Promise<void> {
    const seq = ++this.runSeq;
    const answers = Object.entries(this.state.answers)
      .filter(([, v]) => v.trim())
      .map(([field, value]) => ({ field, kind: "answered" as const, value: value.trim() }));
    this.set({ phase: this.state.result ? this.state.phase : "running", busy: true, revertConfirm: false });
    const outcome = await this.deps.run({
      text: this.textForRun(),
      mode: this.state.mode,
      taskType: this.state.taskType,
      targetModel: this.deps.targetModel,
      answers,
    });
    if (seq !== this.runSeq) return; // a newer run superseded this one
    if (!outcome.ok) {
      this.set({ phase: "invalid", message: outcome.message, result: null, busy: false });
      return;
    }
    this.set({
      phase: "ready",
      result: outcome.result,
      engine: outcome.engine,
      notice: outcome.notice ?? "",
      preview: outcome.result.optimized,
      busy: false,
    });
  }

  setMode(mode: OptimizeMode): Promise<void> {
    if (mode === this.state.mode) return Promise.resolve();
    this.set({ mode, status: null });
    return this.analyze();
  }

  setTaskType(taskType: TaskSelection): Promise<void> {
    if (taskType === this.state.taskType) return Promise.resolve();
    this.set({ taskType, status: null });
    return this.analyze();
  }

  /** Store an answer without re-rendering (keeps typing smooth). */
  setAnswer(field: string, value: string): void {
    this.state.answers = { ...this.state.answers, [field]: value };
  }

  hasAnswers(): boolean {
    return Object.values(this.state.answers).some((v) => v.trim());
  }

  async applyAnswers(): Promise<void> {
    await this.analyze();
    this.set({ status: { kind: "ok", text: "Prompt updated with your answers." } });
  }

  async toggleRedaction(): Promise<void> {
    if (!this.redactableCount() && !this.state.redact) return;
    this.set({ redact: !this.state.redact });
    await this.analyze();
    this.set({
      status: this.state.redact
        ? { kind: "info", text: "Redaction preview on. Replace and Copy will use the redacted text." }
        : { kind: "info", text: "Redaction preview off." },
    });
  }

  async replace(): Promise<void> {
    const { preview, original, written } = this.state;
    if (!preview) return;
    const located = this.deps.composer.locate();
    const current = located.ok ? this.deps.composer.read() : null;
    if (current === null) {
      this.set({ status: { kind: "error", text: "Couldn't find the message box to write into. Use Copy instead." } });
      return;
    }
    const showsOurs = written !== null && sameText(current, written);
    if (!showsOurs && !sameText(current, original)) {
      this.set({
        status: { kind: "warn", text: "The message box changed since this analysis. Re-analyse to include your edits." },
      });
      return;
    }
    const revertTo = showsOurs && this.state.revertTo !== null ? this.state.revertTo : current;
    this.set({ busy: true });
    const res = await this.deps.composer.write(preview);
    if (!res.ok) {
      this.set({
        busy: false,
        status: { kind: "error", text: `${res.reason ?? "Couldn't write to the message box."} Use Copy instead.` },
      });
      return;
    }
    this.set({
      busy: false,
      revertTo,
      written: preview,
      revertConfirm: false,
      status: { kind: "ok", text: "Replaced. Review it, then press the site's send button. Revert restores your original." },
    });
  }

  async revert(): Promise<void> {
    const { revertTo, written, revertConfirm } = this.state;
    if (revertTo === null) return;
    const located = this.deps.composer.locate();
    const current = located.ok ? this.deps.composer.read() : null;
    if (current === null) {
      this.set({ status: { kind: "error", text: "Couldn't find the message box. Your original is still in Copy original." } });
      return;
    }
    if (written !== null && !sameText(current, written) && !revertConfirm) {
      this.set({
        revertConfirm: true,
        status: { kind: "warn", text: "You've edited the message box since replacing. Click Revert again to restore your original anyway." },
      });
      return;
    }
    this.set({ busy: true });
    const res = await this.deps.composer.write(revertTo);
    if (!res.ok) {
      this.set({ busy: false, status: { kind: "error", text: res.reason ?? "Couldn't restore the original text." } });
      return;
    }
    this.set({
      busy: false,
      revertTo: null,
      written: null,
      revertConfirm: false,
      status: { kind: "ok", text: "Original restored." },
    });
  }

  async copy(): Promise<void> {
    if (!this.state.preview) return;
    const ok = await this.deps.copy(this.state.preview);
    this.set({
      status: ok
        ? { kind: "ok", text: "Optimized prompt copied." }
        : { kind: "error", text: "Couldn't copy. Select the preview text and copy it manually." },
    });
  }

  /** Copy the original to the clipboard (never in the URL), then open the web app. */
  async openFullAnalysis(): Promise<void> {
    const text = this.textForRun();
    const copied = text ? await this.deps.copy(text) : false;
    const opened = await this.deps.openWebApp();
    if (!opened) {
      this.set({ status: { kind: "error", text: "Couldn't open the Intruva web app. Check its URL in Options." } });
      return;
    }
    this.set({
      status: copied
        ? { kind: "info", text: "Opened the Intruva workspace. Your prompt is on the clipboard: paste it there. It is never put in the URL." }
        : { kind: "warn", text: "Opened the Intruva workspace. Copying failed, so paste your prompt there manually." },
    });
  }

  clearStatus(): void {
    if (this.state.status) this.set({ status: null });
  }
}
