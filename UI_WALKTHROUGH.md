# UI walkthrough and sales demo script

A screen-by-screen tour of every state, followed by the 3-minute sales demo from plan §29.6.

Run `./start.sh` and open http://localhost:3001. If your computer has *Reduce motion* turned on, click **Motion off** in the header to see the animations.

---

## 1. Landing (`/`)

| Area | What to look at | Interaction |
|---|---|---|
| Header | Animated logo (rotating iridescent rim, light pulse along the "V"), nav, Motion toggle, **Open workspace** | Hover the logo to speed it up. The header turns to glass after you scroll. |
| Hero frame | Real-time WebGL glass sculpture in a light beam, rotating light-sweep border, floating diagnosis chips | **Move the cursor** and the sculpture turns, the light shifts and the chips parallax. **Click the glass** for a ripple. |
| Headline | Words rise in. The accent word cycles: *precise → context-rich → secure → intent-true* | — |
| Prompt bar | Typewriter placeholder showing real messy prompts | Type your own and press **Optimize**. The workspace opens with your prompt, passed through session storage and never put in the URL. "Or try" chips open a sample. |
| How it works | Three-step rail whose connecting line fills as you scroll | — |
| Live demo | Before → Diagnosis → After on the real engine, autoplaying while visible | Switch examples (Coding, Research, Writing, Agent, Debugging●). Click any stage, pause or replay. Watch the scan line, the gap cards, the coverage ring and the prompt reveal. "Open this in the workspace" takes the sample with you. |
| Feature cards | Four tilting cards with a pointer spotlight | **Context:** tap gaps to answer them and watch the gauge climb. **Intent:** switch to *Basic rewriter* and two constraints get struck out. **Security:** *Redact 2 secrets*, *Peek*, *Undo*. **Task-aware:** switch blueprints. |
| Comparison | Basic rewriter vs Intruva table | — |
| Examples | Endless marquee of nine messy prompts | Hover to pause. Click to optimize. |
| Privacy | What's processed, what's retained, what the scan can and can't do | — |
| Final CTA | Light-beam panel | **Optimize your first prompt** |
| Footer | Product, Trust and Developers links. "Designed and developed by Ankur · Handled by ravenclaw_007 LLC" | — |

## 2. Workspace (`/workspace`): every state

| State | How to reach it | What you should see |
|---|---|---|
| **Empty** | Open `/workspace/` | Serif headline, editor with a rotating placeholder, control strip, nine example chips. The amber *Demo mode* badge sits in the header and the step bar. |
| **Typing** | Type `my key is sk-proj-EXAMPLEdoNotUse4f9a2cB71d0e` | Live red highlight under the key, a preflight bar ("found 1 secret") with a clickable finding chip and **Redact 1** (with Undo). The task hint reads "Auto · looks like …". |
| **Validation** | Clear the editor and press ⌘/Ctrl+Enter | Inline amber message. No navigation. |
| **Clear + Undo** | Click **Clear** | A toast with **Undo** restores the text. |
| **Quick run** | Pick *Debug a slow API* → **Optimize** | Result appears immediately (no fake delay). The original prompt is pinned on the left, with intent, security and coverage pills. |
| **Result views** | **Optimized / Compare / Diff** | Structured prompt with styled sections. Side-by-side compare (a toggle on mobile). Word diff with an `<ins>/<del>` legend. |
| **Edit / Reset** | **Edit** → change text → **Save edits** → **Reset edits** | Inline editor. Security re-scans on the edited text. Reset has Undo. |
| **Copy / Download** | **Copy prompt** / **Download .md** | Button turns into "Copied"; toast; `.md` file. |
| **Re-run** | "Try another approach" → Minimal | Minimal keeps the wording exactly and appends output structure only. |
| **Diagnosis tab** | Result → **Diagnosis** | Health headline, 7 dimension bars, ranked gaps, insight cards, security panel. |
| **Deep run** | Mode **Deep** → **Analyze** | Diagnosis first, then **Answer N quick questions** or **Skip, use labelled assumptions**. |
| **Clarify** | Answer questions | One at a time, with "why this matters", chips, assumption preview, Back keeping your answers, and an overview sidebar (desktop). The last **Optimize** button produces the result with your answers as facts. |
| **Security flow** | *Leaky prompt* sample | Four findings: API key, DB credentials, injection override, system-prompt extraction. **Redact all** in Diagnosis re-runs the analysis. In the result, the injected sentence sits under *Untrusted text (data, not instructions)*. |
| **Target AI** | **Advanced** → Target AI → Claude | Output uses XML tags, with an honest note that this is a formatting convention, not benchmarked. |
| **Backend unavailable** | Build with `NEXT_PUBLIC_INTRUVA_API_URL=http://127.0.0.1:9` and run | "The Intruva engine is unreachable", with **Try again**, **Continue in demo mode** and **Edit prompt**. |
| **Mobile** | 390 px wide | Single column, collapsible "Your prompt" card, sticky bottom bar (Copy / Edit / Reset / Download / Edit original), horizontally scrollable example chips. |

## 3. Developers (`/developers`)

Three entry cards, an honest pilot-status note, an API endpoint list with curl / TypeScript / Python tabs (each with Copy), MCP setup tabs for Claude Desktop, Claude Code, Cursor and VS Code with the tool list, and three steps for the Chrome extension.

## 4. Privacy (`/privacy`)

What's processed and where, what's retained (nothing), everything the scan detects plus its stated limits, and what's coming next.

## 5. Not found

Any unknown URL shows a styled 404 with a link to the workspace.

---

## Sales demo script (about 3 minutes, plan §29.6)

1. **Hook (20 s).** On the landing page, move the cursor over the sculpture. "Most AI tools just reword your prompt. Intruva works out what it's missing first."
2. **Vague prompt (20 s).** Click *“Make it cleaner”* in the marquee, or type `Fix this and make it cleaner.` into the hero bar and press **Optimize**.
3. **Diagnosis (40 s).** Open the **Diagnosis** tab. Show task detection with its reason, coverage "weak", and the ranked gaps (existing code, language, constraints). "It tells you *why* each one matters, and it never invents the answer."
4. **Deep questions (40 s).** Click **Edit original**, switch to **Deep**, then **Analyze** → **Answer 3 quick questions**. Pick a chip ("Python 3.12"), skip one, and accept an assumption for the third.
5. **Result (40 s).** Show the optimized prompt, then **Compare** and **Diff**. Point at the green intent checks ("every sentence you wrote is still here") and the *Labelled assumptions* card. Click **Copy prompt** and paste it into the customer's preferred AI.
6. **Security (20 s).** Load *Leaky prompt*. Show the live highlights, then **Redact all**. "This runs on your device. We never see the key."
7. **Close (10 s).** "Free during the pilot, nothing stored. Also available as a Chrome extension inside ChatGPT, Claude and Gemini, an MCP tool for any AI assistant, and an API." Show `/developers`.

**Questions to ask the pilot customer** (qualitative, plan §29.6; never collect their prompts):
- What did you try?
- What changed in the AI's answer?
- Did you trust the optimized prompt?
- How long did it take?
- What felt slow or confusing?
- What would make you use it again tomorrow?
