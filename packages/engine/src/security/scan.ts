/**
 * Local, deterministic security preflight (plan §9 layers 1–2).
 *
 * Runs entirely in the browser. This is intentionally kept even after the
 * remote engine ships: it powers "local-only" mode and the live editor
 * highlights, and it redacts secrets *before* anything is sent remotely.
 *
 * Limitations are explicit and surfaced in the UI. Pattern matching misses
 * novel secret formats and paraphrased injection; it is not a guarantee.
 */
import type { FindingCategory, SecurityFinding, SecurityReport, Severity } from "../contracts";

interface Detector {
  key: string;
  category: FindingCategory;
  severity: Severity;
  title: string;
  pattern: RegExp;
  explanation: string;
  recommendation: string;
  confidence: SecurityFinding["confidence"];
  /** Placeholder used when redacting; omit for non-redactable findings. */
  redact?: string;
  /** Extra validation to cut false positives. */
  validate?: (match: string) => boolean;
  mask?: "secret" | "pii" | "none";
}

const SECRET_EXPLAIN =
  "Credentials pasted into an AI tool can be stored in chat history or provider logs and are hard to revoke later.";
const SECRET_FIX = "Redact it here, and rotate the credential if it was already shared anywhere.";

const DETECTORS: Detector[] = [
  {
    key: "private_key",
    category: "secret",
    severity: "critical",
    title: "Private key block",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
    explanation: "A private key grants direct access to systems or signed identities. " + SECRET_EXPLAIN,
    recommendation: SECRET_FIX,
    confidence: "high",
    redact: "[REDACTED_PRIVATE_KEY]",
    mask: "secret",
  },
  {
    key: "anthropic_key",
    category: "secret",
    severity: "high",
    title: "Anthropic API key",
    pattern: /\bsk-ant-[A-Za-z0-9_-]{16,}/g,
    explanation: SECRET_EXPLAIN,
    recommendation: SECRET_FIX,
    confidence: "high",
    redact: "[REDACTED_API_KEY]",
    mask: "secret",
  },
  {
    key: "openai_key",
    category: "secret",
    severity: "high",
    title: "API key (sk- format)",
    pattern: /\bsk-(?!ant-)(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}/g,
    explanation: SECRET_EXPLAIN,
    recommendation: SECRET_FIX,
    confidence: "high",
    redact: "[REDACTED_API_KEY]",
    mask: "secret",
  },
  {
    key: "aws_key",
    category: "secret",
    severity: "high",
    title: "AWS access key ID",
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    explanation: SECRET_EXPLAIN,
    recommendation: SECRET_FIX,
    confidence: "high",
    redact: "[REDACTED_AWS_KEY]",
    mask: "secret",
  },
  {
    key: "github_token",
    category: "secret",
    severity: "high",
    title: "GitHub token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g,
    explanation: SECRET_EXPLAIN,
    recommendation: SECRET_FIX,
    confidence: "high",
    redact: "[REDACTED_GITHUB_TOKEN]",
    mask: "secret",
  },
  {
    key: "slack_token",
    category: "secret",
    severity: "high",
    title: "Slack token",
    pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
    explanation: SECRET_EXPLAIN,
    recommendation: SECRET_FIX,
    confidence: "high",
    redact: "[REDACTED_SLACK_TOKEN]",
    mask: "secret",
  },
  {
    key: "google_key",
    category: "secret",
    severity: "high",
    title: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    explanation: SECRET_EXPLAIN,
    recommendation: SECRET_FIX,
    confidence: "high",
    redact: "[REDACTED_API_KEY]",
    mask: "secret",
  },
  {
    key: "stripe_key",
    category: "secret",
    severity: "high",
    title: "Stripe secret key",
    pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
    explanation: SECRET_EXPLAIN,
    recommendation: SECRET_FIX,
    confidence: "high",
    redact: "[REDACTED_STRIPE_KEY]",
    mask: "secret",
  },
  {
    key: "jwt",
    category: "secret",
    severity: "medium",
    title: "JSON Web Token",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    explanation: "Session tokens can let someone act as the signed-in user until they expire.",
    recommendation: "Redact the token; share only the decoded claims you need help with.",
    confidence: "high",
    redact: "[REDACTED_JWT]",
    mask: "secret",
  },
  {
    key: "conn_string",
    category: "secret",
    severity: "high",
    title: "Credentials in a connection string",
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@]{3,}@[^\s]+/gi,
    explanation: "The URL embeds a username and password. " + SECRET_EXPLAIN,
    recommendation: "Replace the credentials with placeholders such as USER:PASSWORD.",
    confidence: "high",
    redact: "[REDACTED_CONNECTION_STRING]",
    mask: "secret",
  },
  {
    key: "assigned_secret",
    category: "secret",
    severity: "medium",
    title: "Possible password or secret value",
    pattern: /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*["']?[^\s"',;]{6,}/gi,
    explanation: "This looks like a secret assigned to a variable. It may be a real credential.",
    recommendation: "Redact the value if it is real. Placeholders like <PASSWORD> are fine.",
    confidence: "medium",
    redact: "[REDACTED_SECRET]",
    mask: "secret",
    validate: (m) => !/[<{]|\b(?:example|placeholder|changeme|xxx+|\*{3,})\b/i.test(m),
  },
  {
    key: "card",
    category: "pii",
    severity: "high",
    title: "Payment card number",
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    explanation: "Card numbers are regulated payment data and should not be shared with AI tools.",
    recommendation: "Remove it, or replace it with a test card number.",
    confidence: "medium",
    redact: "[REDACTED_CARD]",
    mask: "pii",
    validate: (m) => luhn(m.replace(/\D/g, "")),
  },
  {
    key: "ssn",
    category: "pii",
    severity: "high",
    title: "US Social Security number",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    explanation: "Government identifiers enable identity theft if exposed.",
    recommendation: "Remove it. The AI almost never needs the real value.",
    confidence: "medium",
    redact: "[REDACTED_ID]",
    mask: "pii",
  },
  {
    key: "aadhaar",
    category: "pii",
    severity: "high",
    title: "Possible Aadhaar number",
    pattern: /\b[2-9]\d{3}\s\d{4}\s\d{4}\b/g,
    explanation: "Government identifiers enable identity theft if exposed.",
    recommendation: "Remove it. The AI almost never needs the real value.",
    confidence: "medium",
    redact: "[REDACTED_ID]",
    mask: "pii",
  },
  {
    key: "pan",
    category: "pii",
    severity: "medium",
    title: "Possible PAN number",
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    explanation: "Tax identifiers are personal data.",
    recommendation: "Remove it or use a placeholder.",
    confidence: "medium",
    redact: "[REDACTED_ID]",
    mask: "pii",
  },
  {
    key: "email",
    category: "pii",
    severity: "low",
    title: "Email address",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    explanation: "Personal contact details may not be needed for the task.",
    recommendation: "Keep it only if the AI actually needs it. Otherwise use a placeholder.",
    confidence: "high",
    redact: "[EMAIL]",
    mask: "pii",
    validate: (m) => !/@example\.(?:com|org)$/i.test(m),
  },
  {
    key: "phone",
    category: "pii",
    severity: "low",
    title: "Phone number",
    pattern: /(?<![\w-])\+?\d{1,3}[ -]?\(?\d{2,4}\)?[ -]?\d{3,4}[ -]?\d{3,4}(?![\w-])/g,
    explanation: "Personal contact details may not be needed for the task.",
    recommendation: "Keep it only if the AI actually needs it. Otherwise use a placeholder.",
    confidence: "low",
    redact: "[PHONE]",
    mask: "pii",
    validate: (m) => m.replace(/\D/g, "").length >= 10 && !luhn(m.replace(/\D/g, "")),
  },
  {
    key: "injection_override",
    category: "prompt_injection",
    severity: "high",
    title: "Instruction override phrase",
    pattern:
      /\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|earlier|preceding|system)\s+(?:instructions?|prompts?|rules?|messages?)/gi,
    explanation:
      "Text like this is a common prompt-injection pattern. If it came from a pasted document, email, or web page, it may try to hijack the AI's task.",
    recommendation:
      "If you didn't write this, put the pasted content in a quoted block and tell the AI to treat it as data, not instructions.",
    confidence: "medium",
    mask: "none",
  },
  {
    key: "injection_reveal",
    category: "prompt_injection",
    severity: "medium",
    title: "Request to reveal hidden instructions",
    pattern: /\b(?:reveal|print|show|output|repeat)\s+(?:your|the)\s+(?:system\s+prompt|hidden\s+instructions?|initial\s+instructions?)/gi,
    explanation: "Attempts to extract system prompts often appear in injected content.",
    recommendation: "Check whether this text came from an untrusted source.",
    confidence: "medium",
    mask: "none",
  },
  {
    key: "injection_persona",
    category: "prompt_injection",
    severity: "medium",
    title: "Safeguard-bypass persona",
    pattern: /\b(?:you\s+are\s+now\s+(?:DAN|in\s+developer\s+mode|unrestricted|jailbroken)|developer\s+mode\s+enabled|jailbreak)/gi,
    explanation: "Persona swaps like this are used to try to bypass model safeguards.",
    recommendation: "Remove it if it is not needed for your task.",
    confidence: "medium",
    mask: "none",
  },
  {
    key: "exfiltration",
    category: "exfiltration",
    severity: "high",
    title: "Instruction to send data elsewhere",
    pattern:
      /\b(?:send|upload|post|forward|transmit|exfiltrate|email)\s+(?:it|this|them|everything|all\s+(?:the\s+)?(?:data|files|results|credentials)|the\s+(?:data|files|results|credentials|conversation))\s+to\s+\S+/gi,
    explanation:
      "Instructions to move data to another destination are risky in agent or tool-using contexts, especially if they came from pasted content.",
    recommendation: "Confirm the destination is yours and expected. Name it explicitly and require approval.",
    confidence: "medium",
    mask: "none",
  },
  {
    key: "tool_unbounded",
    category: "tool_misuse",
    severity: "medium",
    title: "Unbounded permission for an agent",
    pattern:
      /\b(?:do\s+whatever\s+(?:is\s+)?(?:needed|necessary|it\s+takes)|without\s+(?:asking|confirmation|approval)|no\s+(?:need\s+to\s+)?(?:ask|confirm)|full\s+(?:admin\s+)?access|any\s+means\s+necessary)/gi,
    explanation:
      "Open-ended permission makes tool-using AI more likely to take actions you didn't intend.",
    recommendation: "Name the allowed actions, the actions that need your approval, and when to stop.",
    confidence: "medium",
    mask: "none",
  },
  {
    key: "tool_destructive",
    category: "tool_misuse",
    severity: "high",
    title: "Destructive command or action",
    pattern: /\b(?:rm\s+-rf\s+\S+|drop\s+(?:table|database)\s+\w+|delete\s+all\s+\w+|truncate\s+table|disable\s+(?:auth(?:entication)?|security|logging|2fa|mfa))\b/gi,
    explanation: "Irreversible or security-weakening actions need explicit scoping and approval.",
    recommendation: "Add an approval step and a dry-run or backup requirement.",
    confidence: "medium",
    mask: "none",
  },
];

const CONFLICT_PAIRS: Array<[RegExp, RegExp, string]> = [
  [
    /\b(?:brief|short|concise|one\s+line|tl;?dr)\b/i,
    /\b(?:detailed|in[- ]depth|comprehensive|exhaustive|thorough)\b/i,
    "The prompt asks for both a brief and a detailed answer.",
  ],
  [
    /\b(?:don'?t|do\s+not|no)\s+(?:use\s+)?code\b/i,
    /\b(?:write|show|give)\s+(?:me\s+)?(?:the\s+)?code\b/i,
    "The prompt both forbids and asks for code.",
  ],
];

export const SCAN_LIMITATIONS = [
  "Pattern-based: novel secret formats and paraphrased injections can be missed.",
  "Runs only on the text in the editor. Linked files and URLs are not fetched.",
  "A clean result is not a guarantee of safety.",
];

const SEVERITY_RANK: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

export function severityRank(s: Severity | "none"): number {
  return s === "none" ? -1 : SEVERITY_RANK[s];
}

export function scanPrompt(text: string): SecurityReport {
  const findings: SecurityFinding[] = [];
  const taken: Array<[number, number]> = [];

  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);

  for (const d of DETECTORS) {
    d.pattern.lastIndex = 0;
    for (const m of text.matchAll(d.pattern)) {
      const raw = m[0];
      const start = m.index ?? 0;
      const end = start + raw.length;
      if (d.validate && !d.validate(raw)) continue;
      // Earlier detectors are more specific; skip spans they already claimed.
      if (overlaps(start, end)) continue;
      taken.push([start, end]);
      findings.push({
        id: `${d.key}-${start}`,
        category: d.category,
        severity: d.severity,
        title: d.title,
        explanation: d.explanation,
        recommendation: d.recommendation,
        confidence: d.confidence,
        span: { start, end },
        masked_evidence: maskEvidence(raw, d.mask ?? "none"),
        redaction: d.redact ? { replacement: d.redact } : undefined,
      });
    }
  }

  for (const [a, b, msg] of CONFLICT_PAIRS) {
    const ma = a.exec(text);
    const mb = b.exec(text);
    if (ma && mb) {
      const start = Math.min(ma.index, mb.index);
      const end = Math.max(ma.index + ma[0].length, mb.index + mb[0].length);
      findings.push({
        id: `conflict-${start}`,
        category: "instruction_conflict",
        severity: "info",
        title: "Conflicting instructions",
        explanation: `${msg} The AI will have to guess which one you meant.`,
        recommendation: "Keep the one you mean, or say when each applies.",
        confidence: "medium",
        span: { start, end },
        masked_evidence: `“${ma[0]}” vs “${mb[0]}”`,
      });
    }
  }

  findings.sort((x, y) => SEVERITY_RANK[y.severity] - SEVERITY_RANK[x.severity] || x.span.start - y.span.start);

  const top = findings[0]?.severity;
  return {
    risk_level: top ?? "none",
    findings,
    limitations: SCAN_LIMITATIONS,
    engine: "local_patterns",
  };
}

/** Apply selected redactions. Works right-to-left so spans stay valid. */
export function applyRedactions(text: string, findings: SecurityFinding[]): string {
  const redactable = findings
    .filter((f) => f.redaction)
    .sort((a, b) => b.span.start - a.span.start);
  let out = text;
  for (const f of redactable) {
    out = out.slice(0, f.span.start) + f.redaction!.replacement + out.slice(f.span.end);
  }
  return out;
}

function maskEvidence(raw: string, mode: "secret" | "pii" | "none"): string {
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (mode === "none") return oneLine.length > 80 ? oneLine.slice(0, 77) + "…" : oneLine;
  if (mode === "secret") {
    if (oneLine.startsWith("-----BEGIN")) return "-----BEGIN … PRIVATE KEY----- (hidden)";
    const head = oneLine.slice(0, Math.min(4, Math.floor(oneLine.length / 4)));
    return `${head}${"•".repeat(8)} (${oneLine.length} chars hidden)`;
  }
  // PII: keep shape, hide most characters.
  if (oneLine.includes("@")) {
    const [user, domain] = oneLine.split("@");
    return `${user.slice(0, 1)}•••@${domain}`;
  }
  return oneLine.replace(/\d(?=(?:\D*\d){2})/g, "•");
}

function luhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}
