import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { RoadmapBoard } from "@/components/roadmap/RoadmapBoard";
import { PROMISES } from "@/lib/roadmap";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "What's live in Intruva today, what's in beta, and what's coming next: AI-assisted diagnosis, benchmarks, SDKs, team policies and more.",
};

export default function RoadmapPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-iris-300/90">Roadmap</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-fg sm:text-6xl">
          What&apos;s <span className="font-display italic text-aurora">coming</span> to Intruva
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-soft">
          Built from our product plan and shaped by pilot customers. Tap any card to see why it matters and the privacy
          guardrail that comes with it.
        </p>

        <div className="mt-10">
          <RoadmapBoard />
        </div>

        <section aria-labelledby="promises" className="mt-16">
          <h2 id="promises" className="text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-3xl">
            What won&apos;t change
          </h2>
          <p className="mt-2 max-w-2xl text-fg-soft">Every feature on this page has to keep these promises.</p>
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROMISES.map((p) => (
              <li key={p.title} className="glass rounded-2xl p-5">
                <p className="font-medium text-fg">{p.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass-strong mt-16 flex flex-col gap-5 rounded-[1.75rem] p-6 sm:flex-row sm:items-center sm:p-8">
          <Sparkles className="size-7 shrink-0 text-iris-300" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-fg">Free during the pilot</p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">
              Paid tiers (Pro, Developer, Team, Enterprise) will be shaped by what pilot customers actually use.
              Nothing you rely on today will disappear without notice. The roadmap reflects current plans and may change
              based on feedback.
            </p>
          </div>
          <Link
            href="/workspace/"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--color-iris-300),var(--color-iris-500)_55%,var(--color-iris-600))] px-5 text-sm font-medium text-white"
          >
            Try what&apos;s live <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
