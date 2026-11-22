import type { FindingCategory, SecurityFinding } from "@/lib/contracts";

export const categoryClass: Record<FindingCategory, string> = {
  secret: "mark-secret",
  pii: "mark-pii",
  prompt_injection: "mark-injection",
  exfiltration: "mark-injection",
  tool_misuse: "mark-injection",
  instruction_conflict: "mark-info",
};

export const categoryLabel: Record<FindingCategory, string> = {
  secret: "Secret",
  pii: "Personal data",
  prompt_injection: "Injection",
  exfiltration: "Data exfiltration",
  tool_misuse: "Tool misuse",
  instruction_conflict: "Conflict",
};

/**
 * Split text into plain and highlighted segments for the mirror layer.
 * `visible` renders the text itself (read-only views); otherwise the text is
 * transparent and only the mark backgrounds show under the textarea.
 */
export function Highlighted({
  text,
  findings,
  visible = false,
}: {
  text: string;
  findings: SecurityFinding[];
  visible?: boolean;
}) {
  const spans = [...findings]
    .filter((f) => f.category !== "instruction_conflict")
    .sort((a, b) => a.span.start - b.span.start);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((f, i) => {
    if (f.span.start < cursor) return;
    if (f.span.start > cursor) out.push(text.slice(cursor, f.span.start));
    out.push(
      <mark
        key={`${f.id}-${i}`}
        className={categoryClass[f.category]}
        style={visible ? { color: "inherit" } : undefined}
        title={visible ? `${categoryLabel[f.category]}: ${f.title}` : undefined}
      >
        {text.slice(f.span.start, f.span.end)}
      </mark>,
    );
    cursor = f.span.end;
  });
  out.push(text.slice(cursor));
  // Trailing newline needs a character so the mirror height matches the textarea.
  out.push("​");
  return <>{out}</>;
}
