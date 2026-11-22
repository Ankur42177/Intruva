import { SiteFooter } from "@/components/layout/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import {
  Comparison,
  ExampleMarquee,
  FeatureBento,
  FinalCta,
  LiveDemo,
  SectionHead,
  StepsRail,
  TrustGrid,
} from "@/components/landing/Lazy";

export default function Home() {
  return (
    <>
      <Hero />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <section id="how" aria-label="How it works" className="scroll-mt-20 pt-24 sm:pt-32">
          <SectionHead
            kicker="How it works"
            title={
              <>
                Diagnosis first. <span className="font-display italic text-aurora">Then</span> a better prompt.
              </>
            }
            sub="Rewording alone is a commodity. Intruva works out what your request is missing before it changes a single word."
          />
          <div className="mt-12">
            <StepsRail />
          </div>
          <div className="mt-14">
            <LiveDemo />
          </div>
        </section>

        <section id="features" aria-label="Features" className="scroll-mt-20 pt-28 sm:pt-36">
          <SectionHead
            kicker="Play with it"
            title={
              <>
                Four things a rewriter <span className="font-display italic text-aurora">can&apos;t</span> do
              </>
            }
            sub="Every card below is interactive. Tap, toggle, and redact."
          />
          <div className="mt-12">
            <FeatureBento />
          </div>
        </section>

        <section aria-label="Comparison" className="pt-28 sm:pt-36">
          <SectionHead kicker="Not another rewriter" title="Same input. Very different guarantees." center />
          <div className="mx-auto mt-10 max-w-3xl">
            <Comparison />
          </div>
        </section>

        <section id="examples" aria-label="Examples" className="scroll-mt-20 pt-28 sm:pt-36">
          <SectionHead
            kicker="Real prompts, real gaps"
            title="Pick a messy prompt. Watch it get fixed."
            sub="Nine scenarios across coding, research, writing, learning, business, system design, and agents."
          />
          <div className="mt-10">
            <ExampleMarquee />
          </div>
        </section>

        <section id="trust" aria-label="Privacy and trust" className="scroll-mt-20 pt-28 sm:pt-36">
          <SectionHead
            kicker="Privacy by default"
            title={
              <>
                Your prompt is <span className="font-display italic text-aurora">your</span> data.
              </>
            }
            sub="No accounts, no storage, no prompt logging. Here's exactly what happens to your text."
          />
          <div className="mt-12">
            <TrustGrid />
          </div>
        </section>

        <div className="pt-28 sm:pt-36">
          <FinalCta />
        </div>
      </div>

      <SiteFooter />
    </>
  );
}
