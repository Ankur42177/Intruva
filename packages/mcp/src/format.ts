/**
 * Human-readable Markdown for each tool result. This is what models without
 * structured-output support see, so it must carry everything needed to act —
 * in particular the `field` ids an agent passes back as `answers`.
 */
import type { SecurityFinding, SecurityReport } from "@intruva/engine";
import { SCORE_LABELS } from "@intruva/engine";
import type { AnalyzeOutput, ListTaskTypesOutput, OptimizeOutput, ScanOutput } from "./core";

const FOOTER = "_Intruva local rule-based engine (no LLM). Ran on this machine; nothing was sent anywhere._";

const pct = (n: number) => `${Math.round(n * 100)}`;

/** A code fence longer than any backtick run inside `body`. */
export function fenced(body: string, lang = "text"): string {
  const longest = Math.max(0, ...[...body.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${body}\n${fence}`;
}

function scoreLine(s: Record<string, number>): string {
  return (Object.keys(SCORE_LABELS) as Array<keyof typeof SCORE_LABELS>)
    .map((k) => `${SCORE_LABELS[k].label} ${pct(s[k])}`)
    .join(" · ");
}

function findingLine(f: SecurityFinding): string {
  return `- **${f.severity.toUpperCase()}** · ${f.category} · ${f.title}: \`${f.masked_evidence.replace(/`/g, "'")}\` — ${f.recommendation}`;
}

function securitySummary(r: SecurityReport): string {
  if (!r.findings.length) return "No issues found by the local pattern scan (not a guarantee of safety).";
  return `Risk **${r.risk_level.toUpperCase()}** — ${r.findings.length} finding(s).`;
}

function bullets(items: string[]): string {
  return items.map((i) => `- ${i}`).join("\n");
}

/* ------------------------------------------------------------------ analyze */

export function formatAnalysis(a: AnalyzeOutput): string {
  const out: string[] = [];
  out.push("# Intruva prompt diagnosis");
  out.push(
    [
      `**Task:** ${a.task_label} (\`${a.task_type}\`, ${a.task_confidence} confidence) — ${a.task_reason}`,
      `**Intent:** ${a.intent}`,
      `**Context completeness:** ${pct(a.completeness)}% · **Overall score:** ${pct(a.scores.overall)}/100`,
      `**Security:** ${securitySummary(a.security)}`,
    ].join("\n"),
  );

  if (a.questions.length) {
    out.push("## Ask the user (highest impact first; any can be skipped)");
    out.push(
      a.questions
        .map((q, i) =>
          [
            `${i + 1}. **${q.question}** — field \`${q.field}\` (${q.importance} impact)`,
            `   - Why: ${q.why}`,
            q.suggested_answers.length ? `   - Suggested answers: ${q.suggested_answers.map((s) => `“${s}”`).join(" · ")}` : "",
            `   - If skipped, labelled assumption: ${q.assumption}`,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n"),
    );
  }

  const asked = new Set(a.questions.map((q) => q.field));
  const rest = a.missing_context.filter((m) => !asked.has(m.field));
  if (rest.length) {
    out.push(a.questions.length ? "## Other missing context (lower impact)" : "## Missing context (ranked)");
    out.push(bullets(rest.map((m) => `${m.label} — \`${m.field}\`, ${m.importance}: ${m.question}`)));
  }

  const given: string[] = [];
  if (a.known_facts.length) given.push(`**Facts:**\n${bullets(a.known_facts.map((f) => f.text))}`);
  if (a.constraints.length) given.push(`**Constraints:**\n${bullets(a.constraints)}`);
  if (a.output_requirements.length) given.push(`**Output requirements:**\n${bullets(a.output_requirements)}`);
  if (given.length) {
    out.push("## Already in the prompt");
    out.push(given.join("\n\n"));
  }

  out.push("## Scores (0–100)");
  out.push(scoreLine(a.scores));

  if (a.security.findings.length) {
    out.push("## Security findings");
    out.push(a.security.findings.map(findingLine).join("\n"));
  }
  if (a.redaction.applied) out.push(`**Redaction:** ${a.redaction.note}`);

  out.push(`**Next step:** ${a.next_step}`);
  out.push(FOOTER);
  return out.join("\n\n");
}

/* ----------------------------------------------------------------- optimize */

export function formatOptimize(r: OptimizeOutput): string {
  const out: string[] = [];
  const t = r.preservation_summary;
  out.push("# Intruva optimized prompt");
  out.push(
    [
      `**Task:** ${r.task_label} (\`${r.task_type}\`) · **Mode:** ${r.mode} · **Target:** ${r.target_model}`,
      `**Score:** ${pct(r.scores_before.overall)} → ${pct(r.scores_after.overall)} (out of 100)`,
      `**Intent preservation:** ${t.pass} pass · ${t.warn} warn · ${t.fail} fail`,
    ].join("\n"),
  );
  const flagged = r.preservation.filter((p) => p.status !== "pass");
  if (flagged.length) out.push(bullets(flagged.map((p) => `${p.status.toUpperCase()} — ${p.label}: ${p.detail}`)));

  out.push("## Optimized prompt");
  out.push(fenced(r.optimized));

  out.push("## What changed");
  out.push(bullets(r.changes.map((c) => `**${c.title}** — ${c.detail}`)));

  if (r.assumptions_used.length) {
    out.push("## Labelled assumptions (ask the user to confirm or correct)");
    out.push(bullets(r.assumptions_used.map((a) => `\`${a.field}\`: ${a.text}`)));
  }
  if (r.open_questions.length) {
    out.push("## Still worth asking");
    out.push(bullets(r.open_questions.map((q) => `${q.question} — field \`${q.field}\` (${q.importance})`)));
  }
  if (r.unmatched_answer_fields.length)
    out.push(
      `**Note:** answer field(s) ${r.unmatched_answer_fields.map((f) => `\`${f}\``).join(", ")} match no question for ${r.task_label}; any values were added as context as given.`,
    );

  out.push("## Security");
  const sec = [`Original: ${securitySummary(r.security_before)}`, `Optimized: ${securitySummary(r.security_after)}`];
  if (r.redaction.applied) sec.push(`Redaction: ${r.redaction.note}`);
  out.push(sec.join("\n"));
  if (r.security_after.findings.length) out.push(r.security_after.findings.map(findingLine).join("\n"));

  out.push("Show the user the optimized prompt and the assumptions before sending it to another AI.");
  out.push(FOOTER);
  return out.join("\n\n");
}

/* --------------------------------------------------------------------- scan */

export function formatScan(s: ScanOutput): string {
  const out: string[] = [];
  out.push("# Intruva security scan");
  out.push(
    s.finding_count
      ? `**Risk level:** ${s.risk_level.toUpperCase()} — ${s.finding_count} finding(s). Evidence below is masked; raw secret values are never shown.`
      : "**Risk level:** NONE — no issues found by the local pattern scan.",
  );
  if (s.findings.length) {
    out.push("## Findings");
    out.push(
      s.findings
        .map((f) => `${findingLine(f)}\n  - Why: ${f.explanation} (confidence: ${f.confidence}; chars ${f.span.start}–${f.span.end})`)
        .join("\n"),
    );
  }
  if ("redacted_text" in s && s.redacted_text !== undefined) {
    out.push(`## Redacted text (${s.redactions_applied} replacement(s))`);
    out.push(fenced(s.redacted_text));
  }
  out.push("## Limitations");
  out.push(bullets(s.limitations));
  out.push(FOOTER);
  return out.join("\n\n");
}

/* --------------------------------------------------------------- task types */

export function formatTaskTypes(l: ListTaskTypesOutput): string {
  const out: string[] = ["# Intruva task types"];
  for (const t of l.task_types) {
    out.push(
      `## ${t.label} (\`${t.id}\`)\n${t.description}\n\nContext fields checked:\n${bullets(
        t.context_fields.map((f) => `\`${f.field}\` — ${f.label} (${f.importance}${f.required ? ", required" : ""}): ${f.question}`),
      )}`,
    );
  }
  out.push(`## Modes\n${bullets(l.modes.map((m) => `\`${m.id}\` — ${m.description}`))}`);
  out.push(`## Target models\n${bullets(l.target_models.map((m) => `\`${m.id}\` — ${m.description}`))}`);
  return out.join("\n\n");
}
