"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "../ui/Toast";

export interface CodeSample {
  label: string;
  lang: string;
  code: string;
}

/** Tabbed code block with a copy button. Tabs are real ARIA tabs. */
export function CodeTabs({ samples, className }: { samples: CodeSample[]; className?: string }) {
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const s = samples[i];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.code);
      setCopied(true);
      toast("Copied to clipboard");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast("Couldn't access the clipboard. Select the text instead.", { tone: "warn" });
    }
  };

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-950/70", className)}>
      <div className="flex items-center gap-1 border-b border-white/[0.06] px-2 pt-2" role="tablist" aria-label="Code samples">
        {samples.map((x, j) => (
          <button
            key={x.label}
            type="button"
            role="tab"
            aria-selected={i === j}
            onClick={() => setI(j)}
            className={cn(
              "relative rounded-t-lg px-3 pb-2.5 pt-1.5 text-xs font-medium transition-colors",
              i === j ? "text-fg" : "text-fg-muted hover:text-fg-soft",
            )}
          >
            {x.label}
            {i === j && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[linear-gradient(90deg,var(--color-iris-400),var(--color-aqua-400))]" />}
          </button>
        ))}
        <button
          type="button"
          onClick={copy}
          className="ml-auto mb-1.5 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-fg-muted hover:bg-white/[0.06] hover:text-fg"
          aria-label={`Copy ${s.label} sample`}
        >
          {copied ? <Check className="size-3.5 text-ok" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre role="tabpanel" className="max-h-[26rem] overflow-auto p-4 text-[0.8rem] leading-relaxed text-fg-soft">
        <code className="font-mono">{s.code}</code>
      </pre>
    </div>
  );
}
