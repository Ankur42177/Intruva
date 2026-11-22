"use client";

import { m, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import {
  ArrowRight,
  Ban,
  CircleCheck,
  Cpu,
  EyeOff,
  HardDrive,
  ListChecks,
  MessagesSquare,
  ScanSearch,
  ShieldQuestion,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { SAMPLES } from "@/lib/samples";
import { TASK_ICONS } from "../workspace/options";

/* ----------------------------------------------------------- SectionHead */

export function SectionHead({ kicker, title, sub, center }: { kicker: string; title: ReactNode; sub?: string; center?: boolean }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={cn("max-w-2xl", center && "mx-auto text-center")}
    >
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-iris-300/90">{kicker}</p>
      <h2 className="mt-3 text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-fg sm:text-[2.75rem]">{title}</h2>
      {sub && <p className="mt-4 text-base leading-relaxed text-fg-soft sm:text-lg">{sub}</p>}
    </m.div>
  );
}

/* ------------------------------------------------------------ StepsRail */

const STEPS = [
  { icon: <ScanSearch className="size-5" />, title: "Diagnose", body: "Detects the task, maps known facts, and ranks the missing context by its impact on the answer." },
  { icon: <MessagesSquare className="size-5" />, title: "Ask, only if it matters", body: "Up to three questions, one at a time, each with its reason. Skip any of them and it becomes a labelled assumption." },
  { icon: <Wand2 className="size-5" />, title: "Build & verify", body: "Structures the prompt around your words, then checks nothing you asked for was lost, and scans for leaks." },
];

export function StepsRail() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const fill = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  return (
    <div ref={ref} className="relative grid gap-4 md:grid-cols-3">
      <div aria-hidden className="absolute left-0 right-0 top-[2.15rem] hidden h-px bg-white/[0.08] md:block">
        <m.div className="h-full bg-[linear-gradient(90deg,var(--color-iris-400),var(--color-aqua-400))]" style={{ width: fill }} />
      </div>
      {STEPS.map((s, i) => (
        <m.div
          key={s.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <span className="relative z-10 flex size-[4.3rem] items-center justify-center rounded-2xl border border-white/10 bg-ink-900 text-iris-200 shadow-[0_0_40px_-10px_rgb(127_108_255/0.6)]">
            {s.icon}
            <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-iris-400),var(--color-aqua-400))] text-[0.7rem] font-semibold text-ink-950">
              {i + 1}
            </span>
          </span>
          <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em] text-fg">{s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.body}</p>
        </m.div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- Marquee */

export function ExampleMarquee() {
  const items = [...SAMPLES, ...SAMPLES];
  return (
    <div className="relative -mx-4 overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] sm:-mx-6">
      <div className="marquee-track flex w-max animate-marquee gap-4 px-4">
        {items.map((s, i) => (
          <Link
            key={`${s.id}-${i}`}
            href={`/workspace/?sample=${s.id}`}
            tabIndex={i >= SAMPLES.length ? -1 : undefined}
            aria-hidden={i >= SAMPLES.length || undefined}
            className="glass group/card w-[19rem] shrink-0 rounded-2xl p-5 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-white/20"
          >
            <span className="flex items-center gap-2 text-xs text-fg-muted">
              <span className="text-iris-300">{TASK_ICONS[s.family]}</span>
              {s.label}
            </span>
            <p className="mt-3 line-clamp-3 min-h-[4.2rem] font-mono text-[0.8125rem] leading-relaxed text-fg-soft">“{s.prompt}”</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-aqua-300 opacity-70 transition-opacity group-hover/card:opacity-100">
              Optimize this <ArrowRight className="size-3.5 transition-transform group-hover/card:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Trust */

const TRUST = [
  {
    icon: <Cpu className="size-5" />,
    title: "What's processed",
    points: ["Only the text you paste or type", "Demo mode: everything runs in your browser", "The security scan always runs on your device first"],
  },
  {
    icon: <HardDrive className="size-5" />,
    title: "What's retained",
    points: ["Nothing. Prompts are never stored or logged", "No account, no history by default", "Only your motion preference, stored locally"],
  },
  {
    icon: <ShieldQuestion className="size-5" />,
    title: "What the scan can and can't do",
    points: ["Flags common key formats, PII, injection phrases", "Can miss novel formats and paraphrased attacks", "A clean result is not a guarantee of safety"],
  },
];

export function TrustGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {TRUST.map((t, i) => (
        <m.div
          key={t.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="glass rounded-[1.5rem] p-6"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-ok-soft text-ok ring-1 ring-ok/20">{t.icon}</span>
          <h3 className="mt-4 text-lg font-semibold text-fg">{t.title}</h3>
          <ul className="mt-3 space-y-2">
            {t.points.map((p, j) => (
              <li key={p} className="flex gap-2 text-sm leading-relaxed text-fg-soft">
                {i === 2 && j > 0 ? (
                  <Ban className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                ) : i === 1 && j === 0 ? (
                  <EyeOff className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                ) : (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
                )}
                {p}
              </li>
            ))}
          </ul>
        </m.div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- Comparison */

const ROWS: Array<[string, boolean, boolean]> = [
  ["Rewrites the wording", true, true],
  ["Shows what's missing and why", false, true],
  ["Asks only high-impact questions", false, true],
  ["Labels assumptions instead of inventing facts", false, true],
  ["Verifies your constraints survived", false, true],
  ["Scans for secrets & injection before sending", false, true],
];

export function Comparison() {
  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="glass overflow-hidden rounded-[1.75rem]"
    >
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Intruva compared with a basic prompt rewriter</caption>
        <thead>
          <tr className="border-b border-white/[0.06] text-xs uppercase tracking-[0.14em] text-fg-faint">
            <th scope="col" className="px-5 py-4 font-medium sm:px-7">Capability</th>
            <th scope="col" className="px-3 py-4 text-center font-medium">Basic rewriter</th>
            <th scope="col" className="px-5 py-4 text-center font-medium text-iris-300 sm:px-7">Intruva</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, basic, ours], i) => (
            <m.tr
              key={label}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className="border-b border-white/[0.04] last:border-0"
            >
              <th scope="row" className="px-5 py-3.5 font-normal text-fg-soft sm:px-7">{label}</th>
              <td className="px-3 py-3.5 text-center">
                {basic ? <CircleCheck className="mx-auto size-4 text-fg-muted" aria-label="Yes" /> : <span className="text-fg-faint" aria-label="No">—</span>}
              </td>
              <td className="bg-iris-500/[0.04] px-5 py-3.5 text-center sm:px-7">
                {ours && <CircleCheck className="mx-auto size-4 text-ok" aria-label="Yes" />}
              </td>
            </m.tr>
          ))}
        </tbody>
      </table>
    </m.div>
  );
}

/* ------------------------------------------------------------ Final CTA */

export function FinalCta() {
  return (
    <m.section
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="frame-sweep relative isolate overflow-hidden rounded-[2rem] border border-white/[0.06] bg-ink-900 px-6 py-16 text-center sm:px-12 sm:py-20"
    >
      <div aria-hidden className="absolute left-1/2 top-0 -z-10 h-[140%] w-[70%] -translate-x-1/2 animate-beam bg-[conic-gradient(from_180deg_at_50%_0%,transparent_160deg,rgb(255_255_255/0.12)_180deg,transparent_200deg)] blur-xl" />
      <div aria-hidden className="absolute -bottom-40 left-1/2 -z-10 size-[28rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(127_108_255/0.35),transparent_65%)] blur-2xl" />
      <ListChecks className="mx-auto size-8 text-iris-300" aria-hidden />
      <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-fg sm:text-5xl">
        Your next prompt, <span className="font-display italic text-aurora">without the guesswork.</span>
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-fg-soft">Free during the pilot. No signup. Nothing leaves your device.</p>
      <Link
        href="/workspace/"
        className="group mt-8 inline-flex h-13 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--color-iris-300),var(--color-iris-500)_55%,var(--color-iris-600))] px-7 text-[0.95rem] font-medium text-white shadow-[0_0_0_1px_rgb(255_255_255/0.2)_inset,0_14px_40px_-10px_rgb(127_108_255/0.95)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgb(255_255_255/0.3)_inset,0_18px_50px_-10px_rgb(127_108_255/1),0_0_60px_-10px_rgb(92_225_230/0.6)] active:scale-[0.98]"
      >
        Optimize your first prompt <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>
    </m.section>
  );
}
