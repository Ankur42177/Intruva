# Backend mapping: UI ↔ contract ↔ API

This document maps every UI element to the contract field that feeds it (`packages/engine/src/contracts.ts`) and to the REST endpoint that returns it (`services/api`). Use it when you:
- replace the rule-based engine with an AI-assisted one (keep the shapes), or
- point the web app at the API (`NEXT_PUBLIC_INTRUVA_API_URL`).

All JSON is snake_case and identical across the engine, the API, the MCP tools' `structuredContent`, and the extension.

## Endpoints

| Endpoint | Request type | Response type | Used by |
|---|---|---|---|
| `POST /v1/analyze` | `AnalyzeRequest` | `AnalysisResult` | Workspace Deep mode (diagnosis screen); MCP `intruva_analyze_prompt` |
| `POST /v1/optimize` | `OptimizeRequest` (= `AnalyzeRequest` + `answers`) | `OptimizeResult` | Workspace Quick/Minimal, Deep after clarification, re-run; MCP `intruva_optimize_prompt`; extension |
| `POST /v1/security/scan` | `{ prompt, redact? }` | `SecurityReport` (+ `redacted_prompt`) | MCP `intruva_scan_prompt`; API users. The web app always scans locally. |
| `POST /v1/feedback` | `FeedbackRequest` (no prompt text) | 202 | Optional pilot feedback |
| `GET /v1/health` | — | status, engine version | Monitoring |
| `GET /v1/openapi.json` | — | OpenAPI 3.1 | SDK generation |

## Request fields

| Field | Values | UI control |
|---|---|---|
| `prompt` | 8–12,000 chars | Prompt editor (`PromptEditor`), hero prompt bar (via handoff) |
| `task_type` | `auto` or one of 9 families | Task select in `ControlStrip` ("Auto · looks like …") |
| `mode` | `quick` / `deep` / `minimal` | Mode segmented control; "Try another approach" re-run |
| `target_model` | `generic` / `chatgpt` / `claude` / `gemini` | Advanced → Target AI |
| `answers[]` | `{ field, kind: answered/skipped/assumed, value? }` | `ClarifyFlow` (answer, Skip, Use assumption); "Skip, use labelled assumptions" sends all `skipped` |

## `AnalysisResult` → Diagnosis screen (`DiagnosisView`)

| Field | UI |
|---|---|
| `task_type`, `task_confidence`, `task_reason` | Task pill, confidence pill, reason text; "Your prompt" card pill |
| `intent` | **Intent** card |
| `scores.*` (7 dimensions + `overall`) | "Prompt health: *word*" headline; **Quality dimensions** bars (`SCORE_LABELS`, `SCORE_WEIGHTS`) |
| `coverage[]` (`label`, `covered`, `required`) | **Context coverage** card (✓ covered, ◐ assumed, ○ missing) |
| `completeness` | "N of M context fields covered" |
| `missing_context[]` (ranked by `priority`) | **Missing context, ranked by impact** list: label, importance pill, expandable `why`, `question`, `assumption` |
| `questions[]` (deep only, ≤3) | "Answer N quick questions" CTA → `ClarifyFlow` (question, why, `suggested_answers` chips, assumption preview) |
| `constraints[]` | **Constraints you stated** card |
| `output_requirements[]` | **Output expectations** card |
| `known_facts[]` (`source`: prompt/answer) | **Known facts** card with "from prompt" / "your answer" pills |
| `assumptions[]` | **Assumptions if you skip** card |
| `security` | `SecurityPanel` + live editor highlights |
| `requires_clarification` | Chooses between the "Answer questions" and "Optimize now" CTAs |

## `OptimizeResult` → Result screen (`ResultView`)

| Field | UI |
|---|---|
| `optimized` | Focal prompt (`PromptText`), Compare (right pane), Diff (`DiffView`), Copy, Download, Edit |
| `original` | Compare (left pane), Diff base |
| `changes[]` (`kind`, `title`, `detail`) | **What changed and why** (expandable) |
| `preservation[]` (7 checks, `pass/warn/fail`) | **Intent preservation** checklist; "Intent N/7 checks passed" pill |
| `scores_before`, `scores_after` | **Quality dimensions** before/after bars; "Coverage A → B" pill |
| `assumptions_used[]` | **Labelled assumptions** card, plus the "Replace with real answers in Deep mode" link |
| `security_after` | Pill + "Security check on the optimized prompt" panel with redaction (re-scanned locally after edits) |
| `analysis` | **Diagnosis** tab inside results |
| `request_id` | React key; would correlate feedback |

## `SecurityFinding` → security UI

| Field | UI |
|---|---|
| `severity` | Pill tone (only high and critical use red) |
| `title`, `category` | Finding row title and category label |
| `masked_evidence` | Monospace evidence line. **Never render the raw span text from the API.** |
| `explanation`, `recommendation`, `confidence` | "Why this matters & what to do" disclosure |
| `span` | Editor highlight and click-to-select (local scan only) |
| `redaction.replacement` | Redact / Redact all (`applyRedactions`) with Undo |
| `limitations[]` (report) | "What this scan can and can't catch" disclosure |

## Errors → UI states

| Condition | Engine / API | UI |
|---|---|---|
| Empty, too short, or too long | `ValidationError` / 400 `{error:{code,message}}` | Inline message under the editor |
| Network error, timeout (25 s) or 5xx | `BackendUnavailableError` (client) | "The Intruva engine is unreachable": Retry · Continue in demo mode · Edit |
| Other 4xx | `Error(detail)` | "That didn't work": Retry · Edit |
| User cancels / starts a new run | `AbortError` | Silently returns to the previous screen |

## Swapping in an AI-assisted engine later

1. Keep the deterministic modules exactly as they are: `validatePrompt`, `scanPrompt` / `applyRedactions`, `checkPreservation`, scoring.
2. Replace `classify`, `extractParts`, `computeCoverage` and the section builder with LLM calls that return the **same contract types**. Validate every model response against a schema and fall back to the rule-based path on failure.
3. Treat user text strictly as data. Keep system instructions separate from user content (plan §9).
4. Run `npm test -w @intruva/engine`. The preservation and false-positive tests are the regression gate.
