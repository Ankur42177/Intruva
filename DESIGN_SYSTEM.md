# Design system: dark liquid glass

Plan §15 makes UI quality a product requirement. This document describes the system used across the web app. The Chrome extension mirrors these tokens in its own shadow-DOM styles.

All tokens live in `apps/web/src/app/globals.css` (Tailwind v4 `@theme`). **Components must use tokens, not ad-hoc colours.**

## Principles

1. **Glass sits over a deliberate background, not everywhere.** A quiet aurora (`AmbientBackground`) plus three surface levels. Text-heavy content always gets enough opacity behind it.
2. **Hierarchy through elevation and contrast**, not borders. The focal surface (editor, optimized prompt, hero frame) gets `glass-strong` and the `ring-aurora` gradient hairline.
3. **Motion explains.** Every animation communicates state: stage progress, coverage rising, a constraint being dropped, a secret being redacted. Routine transitions take 150–350 ms; reveals take up to about 900 ms.
4. **Calm severity.** Only high and critical security findings use the warm red. Low and info stay neutral, so the product doesn't cry wolf.
5. **Honesty is a visual element.** "Demo mode", "heuristic, not a probability" and "assumed" pills are designed in, not hidden in fine print.

## Tokens

### Colour

| Token | Value | Use |
|---|---|---|
| `ink-950` | `#05060b` | page background |
| `ink-900 / 850 / 800 / 700 / 600` | `#0a0c14` → `#2a3049` | raised surfaces, fallbacks |
| `fg` | `#eef0f7` | primary text |
| `fg-soft` | `#b4b8cc` | body text |
| `fg-muted` | `#8a8fa8` | secondary text (≥ 4.5:1 on ink-950) |
| `fg-faint` | `#5d627a` | decorative labels only |
| `iris-200…600` | `#d9d3ff` → `#6551f0` | primary brand accent |
| `aqua-300…500` | `#9cf0f2` → `#2cc6cf` | secondary accent, focus ring, "after" states |
| `peach-300/400` | `#ffc9a8 / #ffab7d` | warm highlight in gradients only |
| `ok / warn / risk / crit / info` | `#5fe0a4 / #f3c56a / #ff8a7a / #ff5d73 / #86c8ff` | semantic states, each with a `-soft` 12% fill |

**Gradients.** The primary action is `iris-300 → iris-400 → aqua-400` at 135°. `text-aurora` is `iris-300 → aqua-300 → peach-300`, used for one accent word per heading at most.

### Typography

| Role | Font | Notes |
|---|---|---|
| UI / body | Geist (`--font-sans`) | `ss01`, `cv11` features |
| Editorial accent | Instrument Serif italic (`--font-display`) | single accent words, clarification questions |
| Prompts and code | Geist Mono (`--font-mono`) | the editor, results, diffs |

Fonts are self-hosted by `next/font`, so there are no external requests. Headlines use tight tracking (-0.03em to -0.035em) and leading around 1.02–1.1.

### Radius, motion, easing

- Radii: `sm .5rem · md .75rem · lg 1rem · xl 1.25rem · 2xl 1.75rem · 3xl 2.25rem`. Hero frames use 2.5rem.
- Easing: `--ease-out-expo cubic-bezier(.16,1,.3,1)` (the default for reveals), `--ease-spring`, `--ease-glide`.
- Named animations: `drift-a/b` (aurora), `shimmer`, `caret`, `pulse-soft`, `float`, `marquee`, `beam`, `border-sweep` (registered `@property --sweep`), and the `logo-*` set.

## Surfaces (utilities)

| Utility | Recipe | Use |
|---|---|---|
| `glass` | 7.5%→2.5% white gradient over `ink-850/55`, 1px `white/9` border, inner top highlight, soft drop shadow, `blur(22px) saturate(160%)` | cards, panels |
| `glass-strong` | more opacity, `blur(28px)`, deeper shadow | focal panels, popovers, toasts |
| `glass-subtle` | 3.5% white fill and hairline, no blur | chips, inputs, segmented controls |
| `sheen` | pointer-following radial highlight (`--mx/--my`) | hover delight on `GlassCard` |
| `ring-aurora` | masked gradient hairline | focal cards |
| `frame-sweep` | rotating conic light around the border | hero frame, final CTA |
| `noise` | SVG fractal noise | prevents gradient banding |
| `skeleton` / `shimmer-text` | animated placeholders | loading states |

**Fallbacks.** Without `backdrop-filter` support, glass becomes solid `ink-850`. Under 640 px the blur drops to 14 px.

## Components (`components/ui`)

| Component | Behaviour and accessibility |
|---|---|
| `Button` / `ButtonLink` | primary, secondary, ghost, quiet and danger variants. Press scale 0.97, `aria-busy` while loading, min 36–52 px targets. |
| `Select` | WAI-ARIA select-only combobox: arrows, Home/End, type-ahead, Esc, `aria-activedescendant`. |
| `SegmentedControl` | radiogroup with roving tabindex and arrow-key navigation. CSS-only active pill, no layout animation. |
| `Disclosure` | `aria-expanded/controls`, animated height, collapsed content is `inert`. |
| `ScoreBar` | `role="meter"` with `aria-valuetext` ("Fair, 62 of 100, was 34"). Shows the before-ghost bar. Words plus number, never colour alone. |
| `Pill` | tone variants mapped from severity and importance. |
| `Toast` + live region | polite `aria-live` announcer, toasts with an optional Undo action. |

## Motion and accessibility rules

- **Three-state preference** (`MotionPrefs`):
  - `system` (default) follows `prefers-reduced-motion`.
  - `full` forces animation; useful on demo machines with Reduce Motion on.
  - `reduced` minimises motion.
- An inline boot script applies the saved preference before first paint. CSS rules and `MotionConfig` both honour it. The WebGL sculpture renders a still frame when motion is reduced.
- **Bundle discipline.** Motion is loaded through `LazyMotion` with `domAnimation`, using `m.*` components. No layout animations are used.
- **Keyboard and screen readers.**
  - Skip link, visible focus ring (aqua, 2 px, offset 3 px), full keyboard operation of every control.
  - ⌘/Ctrl+Enter runs the optimizer. Enter submits a clarification answer.
  - Semantic `<ins>/<del>` in the diff, plus a legend.
- **Touch.** Controls are at least 36 px (most 40–52 px). Mobile results get a sticky bottom action bar with Copy, Edit, Reset, Download and Edit original, including the safe-area inset.
- **No hover-only features.** Tooltips duplicate visible text, and every hover effect has a tap equivalent.

## Signature pieces

| Piece | File | Notes |
|---|---|---|
| WebGL glass sculpture | `landing/GlassSculpture.tsx`, `landing/glassShader.ts` | Raymarched SDF blobs (smooth union), Fresnel reflection/refraction of a procedural studio, thin-film iridescence on grazing rims, floor soft shadow and reflection, screen-space volumetric beam with dust, ACES tone mapping. Renders at 0.6–0.75× resolution, pauses when off-screen or the tab is hidden, cursor parallax, click ripple, CSS orb fallback. |
| Animated logo | `layout/Logo.tsx` | Rotating iridescent rim behind a ring mask, a draw-in "V" with a travelling light pulse, a breathing core; faster on hover. All CSS, so reduced motion applies. |
| Prompt editor | `workspace/PromptEditor.tsx` | Mirror-layer highlights under a transparent textarea (secret, PII, injection, info), rotating placeholder, char/word count, Clear with Undo, live preflight bar with click-to-select and Redact. |
| Diagnosis | `workspace/DiagnosisView.tsx` | Health headline, quality dimensions with "how is this scored?", ranked gaps (expandable why/question/assumption), six insight cards, security panel. |
| Clarification | `workspace/ClarifyFlow.tsx` | One question at a time with direction-aware transitions, chips, assumption preview, answers overview, answers kept when going back. |
| Result | `workspace/ResultView.tsx` | Optimized / Compare / Diff views, changes with reasons, a 7-check preservation list, before/after bars, labelled assumptions, security re-scan with redaction, re-run in another mode. |

## Adding UI: checklist

- [ ] Uses tokens and utilities only, with no new hex values.
- [ ] Has empty, loading, error and success states.
- [ ] Is keyboard-operable with a visible focus ring, and names its controls.
- [ ] Works at 360 px wide with no horizontal scroll, and has touch targets of 36 px or more.
- [ ] Animates only transform and opacity, and stays understandable with motion off.
- [ ] Never shows a control that does nothing.
