"use client";

import { m } from "motion/react";
import Link from "next/link";
import { ArrowRight, Hammer } from "lucide-react";
import { NEXT_UP, SURFACES } from "@/lib/roadmap";

/** Landing teaser for the roadmap: what's being built next. */
export function ComingSoon() {
  const items = NEXT_UP.slice(0, 4);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, i) => (
        <m.article
          key={item.id}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.08 * i, ease: [0.16, 1, 0.3, 1] }}
          className="glass group relative min-w-0 overflow-hidden rounded-[1.5rem] p-5 transition-transform duration-300 hover:-translate-y-1"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[radial-gradient(circle,rgb(127_108_255/0.25),transparent_65%)] opacity-60 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-iris-400/30 bg-iris-500/15 px-2.5 py-0.5 text-xs font-medium text-iris-200">
            <Hammer className="size-3.5" aria-hidden /> Coming next
          </span>
          <h3 className="mt-3 text-base font-semibold leading-snug text-fg">{item.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{item.why}</p>
          <p className="mt-3 text-[0.7rem] text-fg-faint">{item.surfaces.map((s) => SURFACES[s]).join(" · ")}</p>
        </m.article>
      ))}
      <div className="sm:col-span-2 lg:col-span-4">
        <Link href="/roadmap/" className="group inline-flex items-center gap-2 text-sm font-medium text-aqua-300 hover:text-aqua-400">
          See the full roadmap: live, beta, next and later
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
