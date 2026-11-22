"use client";

import { m } from "motion/react";
import { useId } from "react";
import { Info, ShieldAlert, ShieldCheck, ShieldX, WandSparkles } from "lucide-react";
import type { SecurityFinding, SecurityReport } from "@/lib/contracts";
import { cn } from "@/lib/cn";
import { Disclosure, Pill, severityLabel, severityTone } from "../ui/primitives";
import { categoryLabel } from "./highlight";

/**
 * Calm, legible severity treatment (plan §15.4): only high/critical get the
 * warm red tone; low/info stay neutral so low-risk items don't feel alarming.
 */
export function SecurityPanel({
  report,
  title = "Security preflight",
  onRedact,
  onRedactAll,
  note,
}: {
  report: SecurityReport;
  title?: string;
  onRedact?: (f: SecurityFinding) => void;
  onRedactAll?: () => void;
  note?: string;
}) {
  const titleId = useId();
  const clean = report.findings.length === 0;
  const Icon = clean ? ShieldCheck : report.risk_level === "high" || report.risk_level === "critical" ? ShieldX : ShieldAlert;
  const redactable = report.findings.filter((f) => f.redaction);

  return (
    <section aria-labelledby={titleId} className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            clean ? "bg-ok-soft text-ok" : report.risk_level === "high" || report.risk_level === "critical" ? "bg-risk-soft text-risk" : "bg-warn-soft text-warn",
          )}
        >
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-sm font-medium text-fg">
            {title}
          </h3>
          <p className="text-xs text-fg-muted">
            {clean
              ? "No secrets, personal data, or risky instructions detected by the local scan."
              : `${report.findings.length} finding${report.findings.length > 1 ? "s" : ""} · highest severity: ${severityLabel[report.risk_level].toLowerCase()}`}
          </p>
        </div>
        <Pill tone={severityTone[report.risk_level]}>{clean ? "Clear" : severityLabel[report.risk_level]}</Pill>
        {onRedactAll && redactable.length > 1 && (
          <button
            type="button"
            onClick={onRedactAll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-fg hover:bg-white/[0.1]"
          >
            <WandSparkles className="size-3.5" aria-hidden /> Redact all ({redactable.length})
          </button>
        )}
      </div>

      {note && <p className="mt-3 text-xs text-fg-muted">{note}</p>}

      {!clean && (
        <ul className="mt-4 space-y-2.5">
          {report.findings.map((f, i) => (
            <m.li
              key={f.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={severityTone[f.severity]}>{severityLabel[f.severity]}</Pill>
                <span className="text-sm font-medium text-fg">{f.title}</span>
                <span className="text-xs text-fg-faint">{categoryLabel[f.category]}</span>
                {f.redaction && onRedact && (
                  <button
                    type="button"
                    onClick={() => onRedact(f)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-fg-soft hover:bg-white/[0.06] hover:text-fg"
                  >
                    <WandSparkles className="size-3.5" aria-hidden /> Redact
                    <span className="sr-only"> {f.title}</span>
                  </button>
                )}
              </div>
              <p className="mt-2 font-mono text-xs text-fg-soft [overflow-wrap:anywhere]">
                <span className="sr-only">Evidence (masked): </span>
                {f.masked_evidence}
              </p>
              <Disclosure
                className="mt-2"
                summaryClassName="text-xs text-fg-muted hover:text-fg-soft"
                summary="Why this matters & what to do"
              >
                <div className="space-y-2 pt-2 text-[0.8125rem] leading-relaxed">
                  <p className="text-fg-soft">{f.explanation}</p>
                  <p className="text-fg">
                    <span className="text-fg-muted">Recommended: </span>
                    {f.recommendation}
                  </p>
                  <p className="text-xs text-fg-faint">Detection confidence: {f.confidence}</p>
                </div>
              </Disclosure>
            </m.li>
          ))}
        </ul>
      )}

      <Disclosure
        className="mt-4 border-t border-white/[0.06] pt-3"
        summaryClassName="text-xs text-fg-muted hover:text-fg-soft"
        summary={
          <span className="inline-flex items-center gap-1.5">
            <Info className="size-3.5" aria-hidden /> What this scan can and can&apos;t catch
          </span>
        }
      >
        <ul className="list-disc space-y-1 pl-5 pt-2 text-xs leading-relaxed text-fg-muted">
          {report.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Disclosure>
    </section>
  );
}
