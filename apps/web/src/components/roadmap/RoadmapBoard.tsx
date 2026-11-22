"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, CircleCheck, FlaskConical, Hammer, Lightbulb, Rocket, ShieldCheck, Telescope } from "lucide-react";
import { cn } from "@/lib/cn";
import { ROADMAP, STAGES, SURFACES, type RoadmapItem, type Stage, type Surface } from "@/lib/roadmap";

const LANES: Array<{ id: string; title: string; hint: string; stages: Stage[]; icon: React.ReactNode }> = [
  { id: "now", title: "Now", hint: "Live and in beta", stages: ["live", "beta"], icon: <Rocket className="size-4" aria-hidden /> },
  { id: "next", title: "Next", hint: "Being built next", stages: ["next"], icon: <Hammer className="size-4" aria-hidden /> },
  { id: "later", title: "Later", hint: "Planned and exploring", stages: ["later", "exploring"], icon: <Telescope className="size-4" aria-hidden /> },
];

const stageStyle: Record<Stage, string> = {
  live: "border-ok/30 bg-ok-soft text-ok",
  beta: "border-aqua-400/30 bg-aqua-400/10 text-aqua-300",
  next: "border-iris-400/30 bg-iris-500/15 text-iris-200",
  later: "border-white/10 bg-white/[0.05] text-fg-soft",
  exploring: "border-warn/25 bg-warn-soft text-warn",
};

const stageIcon: Record<Stage, React.ReactNode> = {
  live: <CircleCheck className="size-3.5" aria-hidden />,
  beta: <FlaskConical className="size-3.5" aria-hidden />,
  next: <Hammer className="size-3.5" aria-hidden />,
  later: <Telescope className="size-3.5" aria-hidden />,
  exploring: <Lightbulb className="size-3.5" aria-hidden />,
};

type Filter = "all" | Surface;

export function RoadmapBoard() {
  const [filter, setFilter] = useState<Filter>("all");
  const items = useMemo(() => (filter === "all" ? ROADMAP : ROADMAP.filter((r) => r.surfaces.includes(filter))), [filter]);
  const counts = useMemo(() => {
    const c: Partial<Record<Stage, number>> = {};
    for (const r of ROADMAP) c[r.stage] = (c[r.stage] ?? 0) + 1;
    return c;
  }, []);

  return (
    <div>
      <Journey counts={counts} />

      {/* Filters */}
      <div className="mt-10 -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Filter by product area">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {(["all", ...Object.keys(SURFACES)] as Filter[]).map((f) => {
            const on = filter === f;
            const n = f === "all" ? ROADMAP.length : ROADMAP.filter((r) => r.surfaces.includes(f as Surface)).length;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f)}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[0.8125rem] transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]",
                  on ? "border-iris-400/40 bg-iris-500/15 text-fg" : "border-white/10 bg-white/[0.03] text-fg-muted hover:border-white/20 hover:text-fg",
                )}
              >
                {f === "all" ? "Everything" : SURFACES[f as Surface]}
                <span className={cn("rounded-full px-1.5 text-[0.7rem] tabular-nums", on ? "bg-white/15 text-fg" : "bg-white/[0.06] text-fg-muted")}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lanes */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {LANES.map((lane, li) => {
          const laneItems = items.filter((i) => lane.stages.includes(i.stage));
          return (
            <section key={lane.id} aria-labelledby={`lane-${lane.id}`} className="min-w-0">
              <header className="mb-3 flex items-center gap-2.5 px-1">
                <span className="flex size-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgb(157_143_255/0.3),rgb(92_225_230/0.2))] text-iris-200 ring-1 ring-white/10">
                  {lane.icon}
                </span>
                <div className="min-w-0">
                  <h2 id={`lane-${lane.id}`} className="text-lg font-semibold leading-tight text-fg">
                    {lane.title}
                  </h2>
                  <p className="text-xs text-fg-muted">{lane.hint}</p>
                </div>
                <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-xs tabular-nums text-fg-soft">{laneItems.length}</span>
              </header>
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {laneItems.map((item, i) => (
                    <m.li
                      key={item.id}
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.3, delay: 0.03 * i + 0.05 * li, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <RoadmapCard item={item} />
                    </m.li>
                  ))}
                </AnimatePresence>
                {laneItems.length === 0 && (
                  <li className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-fg-muted">
                    Nothing here for this area yet.
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RoadmapCard({ item }: { item: RoadmapItem }) {
  const [open, setOpen] = useState(false);
  const id = `rm-${item.id}`;
  return (
    <article
      className={cn(
        "glass group relative min-w-0 rounded-2xl transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-white/15",
        item.stage === "live" && "ring-aurora",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-2xl p-4 text-left sm:p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", stageStyle[item.stage])}>
            {stageIcon[item.stage]}
            {STAGES[item.stage].label}
          </span>
          {item.surfaces.map((s) => (
            <span key={s} className="text-[0.7rem] text-fg-muted">
              {SURFACES[s]}
            </span>
          ))}
        </div>
        <h3 className="mt-3 flex items-start justify-between gap-3 text-[0.98rem] font-semibold leading-snug text-fg">
          <span className="min-w-0 break-words">{item.title}</span>
          <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-fg-muted transition-transform duration-300", open && "rotate-180")} aria-hidden />
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-soft">{item.summary}</p>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-2.5 border-t border-white/[0.06] px-4 pb-4 pt-3 text-[0.8125rem] leading-relaxed sm:px-5">
              <p className="text-fg-soft">
                <span className="font-medium text-fg">Why it matters: </span>
                {item.why}
              </p>
              {item.guardrail && (
                <p className="flex gap-2 text-fg-soft">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                  <span>{item.guardrail}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs text-fg-faint">From the product plan {item.plan}</span>
                {item.href && (
                  <Link href={item.href} className="inline-flex items-center gap-1 text-xs font-medium text-aqua-300 hover:text-aqua-400">
                    {item.stage === "live" ? "Try it now" : "See details"} <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                )}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </article>
  );
}

/* Animated journey track: Pilot → Beta → AI engine → Teams → Enterprise */
const MILESTONES = [
  { label: "Pilot", note: "Web app · security · MCP" },
  { label: "Beta", note: "API · Chrome extension" },
  { label: "AI engine", note: "Deeper diagnosis · benchmark" },
  { label: "Teams", note: "Shared policies · history" },
  { label: "Enterprise", note: "SSO · audit · private deploy" },
];
const CURRENT = 1; // index of the milestone we're in

function Journey({ counts }: { counts: Partial<Record<Stage, number>> }) {
  const pct = (CURRENT / (MILESTONES.length - 1)) * 100;
  return (
    <div className="glass-strong ring-aurora relative overflow-hidden rounded-[1.75rem] p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgb(92_225_230/0.16),transparent_65%)]" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-iris-300/90">Where we are</p>
          <p className="mt-1 text-lg font-semibold text-fg sm:text-xl">Pilot → beta, rolling out now</p>
        </div>
        <ul className="flex flex-wrap gap-2 text-xs">
          {(Object.keys(STAGES) as Stage[]).map((s) => (
            <li key={s} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1", stageStyle[s])} title={STAGES[s].blurb}>
              {stageIcon[s]} {STAGES[s].label} <span className="tabular-nums opacity-80">{counts[s] ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-8">
        {/* track */}
        <div className="absolute left-[10%] right-[10%] top-[0.95rem] h-1 rounded-full bg-white/[0.07] max-sm:hidden" aria-hidden>
          <m.div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-ok),var(--color-aqua-400),var(--color-iris-400))]"
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          />
        </div>
        <ol className="relative grid grid-cols-1 gap-4 sm:grid-cols-5 sm:gap-2" aria-label="Product journey">
          {MILESTONES.map((ms, i) => {
            const state = i < CURRENT ? "done" : i === CURRENT ? "current" : "todo";
            return (
              <m.li
                key={ms.label}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 * i, duration: 0.5 }}
                className="flex items-center gap-3 sm:flex-col sm:text-center"
                aria-current={state === "current" ? "step" : undefined}
              >
                <span
                  className={cn(
                    "relative flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    state === "done" && "border-ok/50 bg-ok-soft text-ok",
                    state === "current" && "border-aqua-400/60 bg-ink-900 text-aqua-300 shadow-[0_0_24px_-4px_rgb(92_225_230/0.7)]",
                    state === "todo" && "border-white/15 bg-ink-900 text-fg-muted",
                  )}
                >
                  {state === "done" ? <CircleCheck className="size-4" aria-hidden /> : i + 1}
                  {state === "current" && <span className="absolute inset-0 animate-pulse-soft rounded-full ring-2 ring-aqua-400/40" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium", state === "todo" ? "text-fg-soft" : "text-fg")}>
                    {ms.label}
                    {state === "current" && <span className="ml-1.5 text-xs font-normal text-aqua-300">· now</span>}
                  </span>
                  <span className="block text-xs text-fg-muted">{ms.note}</span>
                </span>
              </m.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
