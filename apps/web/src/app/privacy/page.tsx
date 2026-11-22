import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Ban, CircleCheck, Cpu, HardDrive, ShieldQuestion } from "lucide-react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SCAN_LIMITATIONS } from "@/lib/security/scan";

export const metadata: Metadata = {
  title: "Privacy & data",
  description: "What Intruva processes, what it retains (nothing), and what its security scan can and cannot catch.",
};

const DETECTS = [
  "API keys and tokens (OpenAI-style sk-, Anthropic, AWS, GitHub, Slack, Google, Stripe, JWT)",
  "Private key blocks and credentials inside connection strings",
  "Passwords and secrets assigned to variables",
  "Card numbers (Luhn-checked), US SSN, Aadhaar, PAN, emails, phone numbers",
  "Prompt-injection phrases: instruction overrides, system-prompt extraction, jailbreak personas",
  "Instructions to send data elsewhere, unbounded agent permissions, destructive commands",
  "Conflicting instructions (e.g. “brief” and “detailed”)",
];

export default function PrivacyPage() {
  return (
    <>
      <article className="mx-auto w-full max-w-3xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-iris-300/90">Privacy &amp; data</p>
        <h1 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-fg sm:text-5xl">
          Your prompt is <span className="font-display italic text-aurora">your</span> data.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-fg-soft">
          Prompts often contain source code, work details, personal data, and sometimes credentials. Intruva is designed
          so that, in this pilot, none of it leaves your device.
        </p>

        <section className="glass mt-10 rounded-[1.5rem] p-6 sm:p-8">
          <h2 className="flex items-center gap-2.5 text-xl font-semibold text-fg">
            <Cpu className="size-5 text-ok" aria-hidden /> What&apos;s processed, and where
          </h2>
          <ul className="mt-4 space-y-2.5 text-[0.95rem] leading-relaxed text-fg-soft">
            <li className="flex gap-2.5"><CircleCheck className="mt-1 size-4 shrink-0 text-ok" aria-hidden /> Only the text you type or paste into Intruva.</li>
            <li className="flex gap-2.5"><CircleCheck className="mt-1 size-4 shrink-0 text-ok" aria-hidden /> <span><strong className="font-medium text-fg">Demo mode (current):</strong> analysis, optimization and the security scan all run in your browser. No network request contains your prompt.</span></li>
            <li className="flex gap-2.5"><CircleCheck className="mt-1 size-4 shrink-0 text-ok" aria-hidden /> <span><strong className="font-medium text-fg">When the AI engine is connected:</strong> the indicator in the workspace header will say so. The security scan will still run on your device first, so you can redact secrets before anything is sent.</span></li>
          </ul>
        </section>

        <section className="glass mt-5 rounded-[1.5rem] p-6 sm:p-8">
          <h2 className="flex items-center gap-2.5 text-xl font-semibold text-fg">
            <HardDrive className="size-5 text-ok" aria-hidden /> What&apos;s retained
          </h2>
          <ul className="mt-4 space-y-2.5 text-[0.95rem] leading-relaxed text-fg-soft">
            <li className="flex gap-2.5"><CircleCheck className="mt-1 size-4 shrink-0 text-ok" aria-hidden /> Prompts are never stored: no history, no logs, no account.</li>
            <li className="flex gap-2.5"><CircleCheck className="mt-1 size-4 shrink-0 text-ok" aria-hidden /> A prompt you start on the home page is passed to the workspace through this tab&apos;s session storage, then deleted immediately.</li>
            <li className="flex gap-2.5"><CircleCheck className="mt-1 size-4 shrink-0 text-ok" aria-hidden /> The only thing saved on your device is your animation preference.</li>
            <li className="flex gap-2.5"><CircleCheck className="mt-1 size-4 shrink-0 text-ok" aria-hidden /> No analytics or tracking scripts are included in this pilot build.</li>
          </ul>
        </section>

        <section id="scan" className="glass mt-5 scroll-mt-24 rounded-[1.5rem] p-6 sm:p-8">
          <h2 className="flex items-center gap-2.5 text-xl font-semibold text-fg">
            <ShieldQuestion className="size-5 text-warn" aria-hidden /> What the security scan covers
          </h2>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-fg-soft">It looks for:</p>
          <ul className="mt-3 space-y-2 text-[0.95rem] leading-relaxed text-fg-soft">
            {DETECTS.map((d) => (
              <li key={d} className="flex gap-2.5"><CircleCheck className="mt-1 size-4 shrink-0 text-ok" aria-hidden /> {d}</li>
            ))}
          </ul>
          <p className="mt-5 text-[0.95rem] font-medium text-fg">Its limits:</p>
          <ul className="mt-2 space-y-2 text-[0.95rem] leading-relaxed text-fg-soft">
            {SCAN_LIMITATIONS.map((l) => (
              <li key={l} className="flex gap-2.5"><Ban className="mt-1 size-4 shrink-0 text-warn" aria-hidden /> {l}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-fg-muted">
            Masked evidence is shown in the UI (e.g. <code className="font-mono text-fg-soft">sk-p•••••••• (35 chars hidden)</code>), so
            detected secrets aren&apos;t echoed back on screen.
          </p>
        </section>

        <section id="roadmap" className="glass mt-5 scroll-mt-24 rounded-[1.5rem] p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-fg">Coming next</h2>
          <ul className="mt-4 space-y-2.5 text-[0.95rem] leading-relaxed text-fg-soft">
            <li><strong className="font-medium text-fg">AI-assisted engine.</strong> Deeper diagnosis via a model provider, with explicit disclosure before any prompt leaves your device.</li>
            <li><strong className="font-medium text-fg">Browser extension.</strong> Optimize inside ChatGPT, Claude and Gemini. Reads the composer only when you click.</li>
            <li><strong className="font-medium text-fg">Developer API.</strong> The same analyze, optimize and scan pipeline over REST.</li>
          </ul>
        </section>

        <div className="mt-10">
          <Link href="/workspace/" className="inline-flex items-center gap-2 text-sm font-medium text-aqua-300 hover:text-aqua-400">
            Try it in the workspace <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </article>
      <SiteFooter />
    </>
  );
}
