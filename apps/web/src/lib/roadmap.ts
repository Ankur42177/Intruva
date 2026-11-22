/**
 * Public roadmap — derived from the product plan (prompt_intelligence_product_plan.md).
 * Single source of truth for /roadmap and the landing teaser: update a `stage`
 * here when something ships. No dates on purpose: the plan says to prioritise
 * from pilot evidence, not promises (§19, §29.7).
 */

export type Stage = "live" | "beta" | "next" | "later" | "exploring";
export type Surface = "web" | "extension" | "api" | "mcp" | "engine" | "security" | "teams";

export interface RoadmapItem {
  id: string;
  title: string;
  summary: string;
  /** Why it matters to the customer. */
  why: string;
  /** What we will NOT do / the guardrail that comes with it. */
  guardrail?: string;
  stage: Stage;
  surfaces: Surface[];
  /** Plan section(s) the item comes from. */
  plan: string;
  /** Optional link to try it today. */
  href?: string;
}

export const STAGES: Record<Stage, { label: string; blurb: string }> = {
  live: { label: "Live", blurb: "Available today in the pilot." },
  beta: { label: "In beta", blurb: "Working now. Being hardened with pilot customers." },
  next: { label: "Next", blurb: "Being built next, in roughly this order." },
  later: { label: "Later", blurb: "Planned once the next wave proves its value." },
  exploring: { label: "Exploring", blurb: "Being researched. Your feedback decides." },
};

export const SURFACES: Record<Surface, string> = {
  web: "Web app",
  extension: "Chrome extension",
  api: "Developer API",
  mcp: "MCP server",
  engine: "Intelligence",
  security: "Security",
  teams: "Teams",
};

export const ROADMAP: RoadmapItem[] = [
  /* ------------------------------------------------------------------ live */
  {
    id: "workspace",
    title: "Prompt workspace",
    summary: "Quick, Deep and Minimal modes: diagnosis, 1–3 high-impact questions, and an optimized prompt with an original-vs-optimized diff.",
    why: "Get a better AI answer the first time, without guessing what context the AI is missing.",
    stage: "live",
    surfaces: ["web", "engine"],
    plan: "§5 A, §7, §8",
    href: "/workspace/",
  },
  {
    id: "preflight",
    title: "On-device security preflight",
    summary: "Flags API keys, passwords, personal data, prompt injection and risky agent permissions as you type, with one-click redaction.",
    why: "Stop secrets and customer data from leaking into AI chat history before you press send.",
    guardrail: "Runs in your browser. Nothing is sent anywhere to be scanned.",
    stage: "live",
    surfaces: ["security", "web"],
    plan: "§9",
    href: "/workspace/?sample=secret",
  },
  {
    id: "intent",
    title: "Intent-preservation checks",
    summary: "Seven checks confirm your goal, requirements, prohibitions, output and tone survived optimization, and missing context is labelled as assumptions.",
    why: "You can trust the rewrite didn't quietly change what you asked for or invent facts.",
    stage: "live",
    surfaces: ["engine"],
    plan: "§4 Pillars 3–4, §8",
  },
  {
    id: "mcp",
    title: "MCP server for any AI client",
    summary: "Use Intruva as a tool inside Claude, Cursor, VS Code and other MCP clients: analyze, optimize and scan before your assistant acts.",
    why: "Give any AI assistant a preflight step, whichever model it runs on.",
    stage: "live",
    surfaces: ["mcp"],
    plan: "§5 C (extended)",
    href: "/developers/#mcp",
  },
  /* ------------------------------------------------------------------ beta */
  {
    id: "api",
    title: "Developer API",
    summary: "Analyze, optimize and security-scan over REST on the edge: API keys, rate limits, OpenAPI docs.",
    why: "Add prompt diagnosis and secret scanning to your own product, agents or CI.",
    guardrail: "Prompts are never logged or stored, and keys are stored only as hashes.",
    stage: "beta",
    surfaces: ["api"],
    plan: "§5 C, §22 C0",
    href: "/developers/#api",
  },
  {
    id: "extension",
    title: "Chrome extension",
    summary: "Optimize and scan right inside ChatGPT, Claude and Gemini. Preview, replace, copy or revert, all on your device.",
    why: "No copy-paste between tabs: fix the prompt where you're already writing it.",
    guardrail: "Reads the message box only when you click, and never sends for you.",
    stage: "beta",
    surfaces: ["extension"],
    plan: "§5 B, §21 B0–B1",
    href: "/developers/#extension",
  },
  /* ------------------------------------------------------------------ next */
  {
    id: "ai-engine",
    title: "AI-assisted engine",
    summary: "Deeper understanding of intent and context using a language model, validated against a strict schema, with today's rule-based engine as a fallback.",
    why: "Smarter questions and better prompts for messy, real-world requests.",
    guardrail: "Opt-in, with a clear notice before any text leaves your device. Secrets are redacted first.",
    stage: "next",
    surfaces: ["engine"],
    plan: "§6, §12",
  },
  {
    id: "benchmark",
    title: "Published benchmark",
    summary: "A blind comparison of Intruva against a basic prompt rewriter on 300+ real-world prompts, with the methodology made public.",
    why: "Evidence, not marketing: see whether the AI's answers actually get better.",
    stage: "next",
    surfaces: ["engine"],
    plan: "§11",
  },
  {
    id: "feedback",
    title: "“Did it help?” outcome feedback",
    summary: "Optionally rate whether the AI's answer improved, so the system learns what works.",
    why: "The product improves on real outcomes, not prompt length.",
    guardrail: "Never collects your prompt text, and is opt-in only.",
    stage: "next",
    surfaces: ["web", "extension"],
    plan: "§4 Pillar 7, §19",
  },
  {
    id: "model-aware",
    title: "Model-aware optimization",
    summary: "Adapts structure for ChatGPT, Claude or Gemini, but only where benchmarks show a real improvement.",
    why: "Each model gets the format it handles best, without folklore.",
    stage: "next",
    surfaces: ["engine"],
    plan: "§8 modes",
  },
  {
    id: "sdks",
    title: "TypeScript & Python SDKs",
    summary: "Typed clients for the Developer API, with retries and examples.",
    why: "Integrate in minutes from your backend or notebooks.",
    stage: "next",
    surfaces: ["api"],
    plan: "§5 C5",
  },
  {
    id: "remote-ext",
    title: "Opt-in remote analysis in the extension",
    summary: "Use the AI-assisted engine from inside ChatGPT, Claude and Gemini once it ships.",
    why: "Deeper diagnosis without leaving the chat.",
    guardrail: "Off by default. Shows exactly what is sent, and redacts secrets first.",
    stage: "next",
    surfaces: ["extension", "security"],
    plan: "§5 B3–B4",
  },
  /* ----------------------------------------------------------------- later */
  {
    id: "history",
    title: "Prompt history & preferences",
    summary: "Save prompts and your preferred tone, format and technical level, with export and delete at any time.",
    why: "Reuse what worked and get prompts tailored to how you work.",
    guardrail: "Opt-in. Off by default, as it is today.",
    stage: "later",
    surfaces: ["web", "extension"],
    plan: "§5 A2, §21 B2, §18 Pro",
  },
  {
    id: "batch-eval",
    title: "Batch & evaluation endpoints",
    summary: "Optimize many prompts at once and score them against a rubric or dataset.",
    why: "Improve prompt libraries and AI features systematically, not one by one.",
    stage: "later",
    surfaces: ["api"],
    plan: "§5 C1–C2, §22 C1",
  },
  {
    id: "layered-security",
    title: "Layered AI security review",
    summary: "Contextual review of injected instructions and risky tool use on top of pattern checks, with a policy evaluator.",
    why: "Catches paraphrased attacks that patterns alone miss.",
    stage: "later",
    surfaces: ["security"],
    plan: "§9 layers 3–5",
  },
  {
    id: "teams",
    title: "Team workspaces & policies",
    summary: "Shared templates, team rules for what must never be sent to AI, and usage insights.",
    why: "A consistent, safer instruction layer for everyday AI use across a team.",
    stage: "later",
    surfaces: ["teams"],
    plan: "§18 Team, §21 B5, §22 C2",
  },
  {
    id: "enterprise",
    title: "Enterprise controls",
    summary: "SSO and roles, audit metadata, tenant isolation, custom security rules and private deployment options.",
    why: "Run Intruva under your organisation's compliance requirements.",
    stage: "later",
    surfaces: ["teams", "security"],
    plan: "§18 Enterprise, §22 C2",
  },
  {
    id: "more-sites",
    title: "More AI sites in the extension",
    summary: "Additional chat tools (for example Copilot) once the first three adapters are proven stable.",
    why: "One preflight, wherever you use AI.",
    stage: "later",
    surfaces: ["extension"],
    plan: "§5 B1",
  },
  /* ------------------------------------------------------------- exploring */
  {
    id: "multilang",
    title: "Multi-language prompts",
    summary: "Diagnosis and optimization for prompts written in languages other than English.",
    why: "Better AI results for teams that don't work in English.",
    stage: "exploring",
    surfaces: ["engine"],
    plan: "§5 B5",
  },
  {
    id: "snippets",
    title: "Context snippets",
    summary: "Attach context you explicitly choose (project facts, style, constraints) to any prompt.",
    why: "Stop retyping the same background for every request.",
    guardrail: "Only what you select. No automatic reading of your data.",
    stage: "exploring",
    surfaces: ["extension", "web"],
    plan: "§5 B5",
  },
  {
    id: "media",
    title: "Image & video prompts",
    summary: "Diagnosis for image and video generation prompts.",
    why: "The same clarity for creative and visual work.",
    stage: "exploring",
    surfaces: ["engine"],
    plan: "§5 A4 (excluded from first release)",
  },
];

/** Principles from the plan that every future feature must keep. */
export const PROMISES = [
  { title: "Nothing stored by default", body: "Prompts are not retained or logged. History will always be opt-in." },
  { title: "Never sends for you", body: "Intruva prepares the prompt. You decide where it goes." },
  { title: "Facts vs assumptions", body: "Missing context is labelled, never invented." },
  { title: "Honest scores", body: "Quality scores are explained heuristics, never a fake “accuracy %”." },
];

export const NEXT_UP = ROADMAP.filter((r) => r.stage === "next");
