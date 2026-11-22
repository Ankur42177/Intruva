"use client";

import { diffWords } from "diff";
import { useMemo } from "react";

/**
 * Word-level diff, original → optimized. Never colour-only (plan §15.6):
 * additions use <ins> + underline, removals use <del> + strikethrough, and a
 * legend explains both. Loaded lazily — only when the Diff view is opened.
 */
export default function DiffView({ original, optimized }: { original: string; optimized: string }) {
  const parts = useMemo(() => diffWords(original, optimized), [original, optimized]);
  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    let kept = 0;
    for (const p of parts) {
      const n = p.value.trim().split(/\s+/).filter(Boolean).length;
      if (p.added) added += n;
      else if (p.removed) removed += n;
      else kept += n;
    }
    return { added, removed, kept };
  }, [parts]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded px-1 font-mono text-fg-soft ring-1 ring-white/15">Aa</span> kept ({stats.kept} words)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ins className="diff-add px-1 font-mono no-underline">+ Aa</ins> added ({stats.added})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <del className="diff-del px-1 font-mono">− Aa</del> removed ({stats.removed})
        </span>
      </div>
      <p className="whitespace-pre-wrap font-mono text-[0.875rem] leading-[1.8] text-fg-soft [overflow-wrap:anywhere]">
        {parts.map((p, i) =>
          p.added ? (
            <ins key={i} className="diff-add">
              {p.value}
            </ins>
          ) : p.removed ? (
            <del key={i} className="diff-del">
              {p.value}
            </del>
          ) : (
            <span key={i} className="text-fg">
              {p.value}
            </span>
          ),
        )}
      </p>
    </div>
  );
}
