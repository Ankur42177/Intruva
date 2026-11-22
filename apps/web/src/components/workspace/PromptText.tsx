import { cn } from "@/lib/cn";

/**
 * Read-only prompt renderer with light "syntax" structure: section headings,
 * XML tags, bullets and numbered steps get distinct treatments. Copy actions
 * always use the raw string, never this rendering.
 */
export function PromptText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={cn("font-mono text-[0.875rem] leading-[1.75] text-fg", className)}>
      {lines.map((line, i) => {
        const key = `${i}-${line.slice(0, 12)}`;
        if (/^##\s/.test(line))
          return (
            <p key={key} className={cn("font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-iris-300", i > 0 && "mt-4")}>
              {line.replace(/^##\s/, "")}
            </p>
          );
        if (/^<\/?[a-z_]+>$/.test(line.trim()))
          return (
            <p key={key} className={cn("text-aqua-300/80", line.startsWith("</") ? "mb-3" : i > 0 && "mt-1")}>
              {line}
            </p>
          );
        if (/^-\s/.test(line))
          return (
            <p key={key} className="flex gap-2.5 pl-1 text-fg-soft">
              <span className="text-fg-faint" aria-hidden>
                •
              </span>
              <span className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{line.slice(2)}</span>
            </p>
          );
        if (/^\d+\.\s/.test(line)) {
          const [, n, rest] = line.match(/^(\d+)\.\s(.*)$/) ?? [];
          return (
            <p key={key} className="flex gap-2.5 pl-1 text-fg-soft">
              <span className="tabular-nums text-fg-faint">{n}.</span>
              <span className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{rest}</span>
            </p>
          );
        }
        if (!line.trim()) return <div key={key} className="h-3" aria-hidden />;
        return (
          <p key={key} className="whitespace-pre-wrap [overflow-wrap:anywhere]">
            {line}
          </p>
        );
      })}
    </div>
  );
}
