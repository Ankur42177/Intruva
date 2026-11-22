/**
 * Panel view: renders a PanelSession's state into plain DOM. Stateless apart
 * from what lives in the session, so it can be re-rendered at any time.
 */
import { BLUEPRINTS, TASK_ORDER, type OptimizeMode, type SecurityFinding, type TaskSelection } from "@intruva/engine";
import type { PanelSession, SessionState } from "../core/session";
import { h, logoMark } from "../shared/dom";

export interface PanelEnv {
  siteName: string;
  remoteHost: string | null;
  onClose(): void;
}

const MODES: Array<{ id: OptimizeMode; label: string; hint: string }> = [
  { id: "quick", label: "Quick", hint: "Structure + labelled assumptions, no questions" },
  { id: "deep", label: "Deep", hint: "Ranks the 1–3 questions that matter most" },
  { id: "minimal", label: "Minimal", hint: "Smallest change: your words plus output and assumptions" },
];

const SEVERITY_LABEL: Record<SecurityFinding["severity"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Note",
};

export function renderPanel(session: PanelSession, env: PanelEnv): HTMLElement[] {
  const st = session.state;
  return [renderHead(session, env), ...renderMain(session, env, st)];
}

function renderHead(session: PanelSession, env: PanelEnv): HTMLElement {
  const st = session.state;
  const engineLabel =
    st.engine === "remote" && env.remoteHost
      ? `${env.siteName} · remote analysis via ${env.remoteHost}`
      : `${env.siteName} · rule-based engine, runs on your device`;
  return h(
    "div",
    { class: "head" },
    logoMark(22),
    h("div", { class: "grow" }, h("div", { class: "title", id: "intruva-title" }, "Intruva"), h("div", { class: "sub" }, engineLabel)),
    st.phase === "ready" || st.phase === "invalid"
      ? h(
          "button",
          {
            class: "btn icon ghost",
            type: "button",
            "data-key": "reanalyze",
            "data-intruva": "reanalyze",
            "aria-label": "Re-read the message box and analyse again",
            title: "Re-analyse",
            onclick: () => void session.reanalyze(),
          },
          "↻",
        )
      : null,
    h(
      "button",
      {
        class: "btn icon ghost",
        type: "button",
        "data-key": "close",
        "data-intruva": "close",
        "aria-label": "Close Intruva (Esc)",
        title: "Close (Esc)",
        onclick: () => env.onClose(),
      },
      "✕",
    ),
  );
}

function renderMain(session: PanelSession, env: PanelEnv, st: SessionState): HTMLElement[] {
  if (st.phase === "no-composer") {
    return [
      h(
        "div",
        { class: "body" },
        h(
          "div",
          { class: "empty", "data-intruva": "no-composer" },
          h("div", { class: "icon-ring", "aria-hidden": "true" }, "!"),
          h("div", { class: "title" }, "Message box not found"),
          h("div", { class: "muted" }, st.message),
          h(
            "button",
            { class: "btn", type: "button", "data-key": "retry", onclick: () => void session.start() },
            "Try again",
          ),
        ),
      ),
      footer(st),
    ];
  }
  if (st.phase === "invalid") {
    return [
      h(
        "div",
        { class: "body" },
        h(
          "div",
          { class: "empty", "data-intruva": "invalid" },
          h("div", { class: "muted" }, st.message),
          h(
            "button",
            { class: "btn", type: "button", "data-key": "retry", onclick: () => void session.start() },
            "Analyse again",
          ),
        ),
      ),
      footer(st),
    ];
  }
  if (st.phase !== "ready" || !st.result) {
    return [
      h(
        "div",
        { class: "body" },
        h("div", { class: "empty", role: "status" }, h("div", { class: "spinner", "aria-hidden": "true" }), h("div", { class: "muted" }, "Analysing…")),
      ),
    ];
  }

  const r = st.result;
  const a = r.analysis;
  const body = h("div", { class: "body", "data-intruva": "body" });

  // Task + mode
  const detected = BLUEPRINTS[a.task_type]?.label ?? a.task_type;
  const taskSelect = h(
    "select",
    {
      "data-key": "task",
      "data-intruva": "task",
      "aria-label": "Task type",
      onchange: (e: Event) => void session.setTaskType((e.target as HTMLSelectElement).value as TaskSelection),
    },
    h("option", { value: "auto" }, `Auto · ${detected}`),
    ...TASK_ORDER.map((f) => h("option", { value: f }, BLUEPRINTS[f].label)),
  );
  taskSelect.value = st.taskType;
  const seg = h(
    "div",
    { class: "seg", role: "radiogroup", "aria-label": "Optimization mode" },
    ...MODES.map((m) =>
      h(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": String(st.mode === m.id),
          tabindex: st.mode === m.id ? 0 : -1,
          title: m.hint,
          "data-key": `mode-${m.id}`,
          "data-intruva": `mode-${m.id}`,
          onclick: () => void session.setMode(m.id),
          onkeydown: (e: KeyboardEvent) => {
            const i = MODES.findIndex((x) => x.id === st.mode);
            const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
            if (!step) return;
            e.preventDefault();
            void session.setMode(MODES[(i + step + MODES.length) % MODES.length].id);
          },
        },
        m.label,
      ),
    ),
  );
  body.append(
    h(
      "div",
      { class: "row between" },
      h("div", { class: "row" }, h("span", { class: "faint" }, "Task"), taskSelect),
      seg,
    ),
    h(
      "div",
      { class: "faint" },
      st.taskType === "auto" ? `Detected ${detected} (${a.task_confidence} confidence). ${a.task_reason}` : "Task type set by you.",
    ),
  );

  // Scores + intent checks
  const passed = r.preservation.filter((p) => p.status === "pass").length;
  const issues = r.preservation.filter((p) => p.status !== "pass");
  body.append(
    h(
      "div",
      { class: "scores" },
      h(
        "div",
        { class: "card score" },
        h("div", { class: "faint" }, "Prompt score"),
        h("div", null, h("b", null, String(r.scores_before.overall)), h("span", { class: "muted" }, " → "), h("b", { class: "grad-text" }, String(r.scores_after.overall))),
      ),
      h(
        "div",
        { class: "card score" },
        h("div", { class: "faint" }, "Intent checks"),
        h(
          "div",
          null,
          h("b", { class: issues.length ? "" : "grad-text" }, `${passed}/${r.preservation.length}`),
          h("span", { class: "muted" }, issues.length ? " passed" : " kept"),
        ),
      ),
    ),
  );
  if (issues.length) {
    body.append(
      h(
        "div",
        { class: "notice" },
        ...issues.map((p) => h("div", null, `${p.label}: ${p.detail}`)),
      ),
    );
  }
  if (st.notice) body.append(h("div", { class: `notice${st.engine === "remote" ? " remote" : ""}`, role: "note" }, st.notice));

  body.append(renderGaps(session, st));
  body.append(renderSecurity(session, st));

  // Preview
  const assumptions = r.assumptions_used.length;
  body.append(
    h(
      "section",
      { "aria-labelledby": "intruva-preview-label" },
      h(
        "div",
        { class: "row between" },
        h("div", { class: "section-label", id: "intruva-preview-label" }, "Optimized prompt"),
        st.redact ? h("span", { class: "pill warn" }, "Redacted") : null,
      ),
      h("pre", { class: "preview", tabindex: 0, "data-intruva": "preview", "aria-label": "Optimized prompt preview" }, st.preview),
      assumptions
        ? h("div", { class: "faint", style: "margin-top:6px" }, `Includes ${assumptions} labelled assumption${assumptions === 1 ? "" : "s"}. Answer the questions above to replace them with facts.`)
        : null,
      r.changes.length
        ? h(
            "details",
            { style: "margin-top:6px" },
            h("summary", null, `What changed (${r.changes.length})`),
            h("ul", null, ...r.changes.map((c) => h("li", null, h("b", null, c.title), ` · ${c.detail}`))),
          )
        : null,
    ),
  );

  return [body, footer(st, session)];
}

function renderGaps(session: PanelSession, st: SessionState): HTMLElement {
  const gaps = session.gaps();
  const sec = h("section", { "aria-labelledby": "intruva-gaps-label" }, h("div", { class: "section-label", id: "intruva-gaps-label" }, "Missing context"));
  if (!gaps.length) {
    sec.append(h("div", { class: "card muted" }, "No important context gaps found."));
    return sec;
  }
  const card = h("div", { class: "card", "data-intruva": "gaps" });
  const applyBtn = h(
    "button",
    {
      class: "btn small",
      type: "button",
      "data-key": "apply-answers",
      "data-intruva": "apply-answers",
      disabled: !session.hasAnswers(),
      onclick: () => void session.applyAnswers(),
    },
    "Update prompt with answers",
  );
  for (const g of gaps) {
    const inputId = `intruva-answer-${g.field}`;
    const input = h("input", {
      type: "text",
      id: inputId,
      "data-key": `answer-${g.field}`,
      placeholder: g.suggested_answers[0] ? `e.g. ${g.suggested_answers[0]}` : "Your answer (optional)",
      autocomplete: "off",
      spellcheck: "false",
      oninput: (e: Event) => {
        session.setAnswer(g.field, (e.target as HTMLInputElement).value);
        applyBtn.disabled = !session.hasAnswers();
      },
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === "Enter" && session.hasAnswers()) {
          e.preventDefault();
          void session.applyAnswers();
        }
      },
    });
    input.value = st.answers[g.field] ?? "";
    const tone = g.importance === "high" ? "risk" : g.importance === "medium" ? "warn" : "";
    card.append(
      h(
        "div",
        { class: "gap" },
        h("div", { class: "row between" }, h("b", null, g.label), h("span", { class: `pill ${tone}` }, `${g.importance} impact`)),
        h("label", { class: "gap-q", for: inputId }, g.question),
        h("div", { class: "faint" }, g.why),
        input,
        g.suggested_answers.length
          ? h(
              "div",
              { class: "chips" },
              ...g.suggested_answers.slice(0, 3).map((ans, i) =>
                h(
                  "button",
                  {
                    class: "chip",
                    type: "button",
                    "data-key": `chip-${g.field}-${i}`,
                    onclick: () => {
                      input.value = ans;
                      session.setAnswer(g.field, ans);
                      applyBtn.disabled = false;
                    },
                  },
                  ans,
                ),
              ),
            )
          : null,
      ),
    );
  }
  card.append(h("div", { class: "row", style: "margin-top:10px" }, applyBtn));
  sec.append(card);
  return sec;
}

function renderSecurity(session: PanelSession, st: SessionState): HTMLElement {
  const findings = st.originalFindings;
  const sec = h("section", { "aria-labelledby": "intruva-sec-label" });
  const top = findings[0]?.severity;
  sec.append(
    h(
      "div",
      { class: "row between" },
      h("div", { class: "section-label", id: "intruva-sec-label" }, "Security preflight"),
      findings.length
        ? h("span", { class: `pill ${top === "critical" || top === "high" ? "risk" : top === "medium" ? "warn" : ""}` }, `${findings.length} finding${findings.length === 1 ? "" : "s"}`)
        : h("span", { class: "pill ok" }, h("span", { class: "dot" }), "Clear"),
    ),
  );
  if (!findings.length) {
    sec.append(
      h(
        "div",
        { class: "card" },
        h("div", { class: "muted" }, "No secrets, personal data, injection, or risky agent instructions found."),
        h("div", { class: "faint" }, "Pattern-based check: a clean result is not a guarantee."),
      ),
    );
    return sec;
  }
  const card = h("div", { class: "card", "data-intruva": "findings" });
  for (const f of findings.slice(0, 5)) {
    card.append(
      h(
        "div",
        { class: "finding" },
        h("span", { class: `dot sev-${f.severity}`, "aria-hidden": "true" }),
        h("div", null, h("b", null, f.title), h("span", { class: `sev-${f.severity}` }, ` · ${SEVERITY_LABEL[f.severity]}`)),
        h("span"),
        h("code", { class: "evidence" }, f.masked_evidence),
        h("span"),
        h("div", { class: "faint" }, f.recommendation),
      ),
    );
  }
  if (findings.length > 5) card.append(h("div", { class: "faint", style: "margin-top:8px" }, `+${findings.length - 5} more. Open the full analysis to see all.`));
  const redactable = session.redactableCount();
  if (redactable || st.redact) {
    card.append(
      h(
        "div",
        { class: "row", style: "margin-top:10px" },
        h(
          "button",
          {
            class: "btn small",
            type: "button",
            "data-key": "redact",
            "data-intruva": "redact",
            "aria-pressed": String(st.redact),
            onclick: () => void session.toggleRedaction(),
          },
          st.redact ? "Undo redaction preview" : `Preview redaction (${redactable})`,
        ),
        h("span", { class: "faint" }, st.redact ? "Replace and Copy use the redacted text." : "Swaps detected values for placeholders."),
      ),
    );
  }
  sec.append(card);
  return sec;
}

function footer(st: SessionState, session?: PanelSession): HTMLElement {
  const foot = h("div", { class: "foot" });
  if (session && st.phase === "ready") {
    const risky = st.originalFindings.some((f) => (f.severity === "critical" || f.severity === "high") && f.redaction) && !st.redact;
    foot.append(
      h(
        "div",
        { class: "actions" },
        h(
          "button",
          {
            class: "btn primary",
            type: "button",
            "data-key": "replace",
            "data-intruva": "replace",
            disabled: st.busy || !st.preview,
            onclick: () => void session.replace(),
          },
          "Replace in message box",
        ),
        h(
          "button",
          { class: "btn", type: "button", "data-key": "copy", "data-intruva": "copy", disabled: !st.preview, onclick: () => void session.copy() },
          "Copy",
        ),
        h(
          "button",
          {
            class: "btn",
            type: "button",
            "data-key": "revert",
            "data-intruva": "revert",
            disabled: st.busy || !session.canRevert(),
            title: "Restore the text you had before replacing",
            onclick: () => void session.revert(),
          },
          "Revert",
        ),
        h(
          "button",
          {
            class: "btn",
            type: "button",
            "data-key": "open-full",
            "data-intruva": "open-full",
            title: "Copies your prompt and opens the Intruva workspace",
            onclick: () => void session.openFullAnalysis(),
          },
          "Full analysis",
        ),
      ),
    );
    if (risky) {
      foot.append(h("div", { class: "status warn" }, "Sensitive values detected. Consider Preview redaction before replacing."));
    }
  }
  foot.append(
    h(
      "div",
      { class: `status ${st.status?.kind ?? ""}`, role: "status", "aria-live": "polite", "data-intruva": "status" },
      st.status?.text ?? "",
    ),
  );
  foot.append(h("div", { class: "faint" }, "Intruva never sends for you. Review, then press the site's send button."));
  return foot;
}
