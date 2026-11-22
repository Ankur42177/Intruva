"use client";

/**
 * Below-the-fold landing sections, code-split so the hero (the LCP area and
 * the prompt bar) hydrates first. Still prerendered into the static HTML.
 * dynamic() must live in a Client Component for splitting to apply.
 */
import dynamic from "next/dynamic";

export const LiveDemo = dynamic(() => import("./LiveDemo").then((m) => m.LiveDemo));
export const FeatureBento = dynamic(() => import("./FeatureBento").then((m) => m.FeatureBento));
export const StepsRail = dynamic(() => import("./Sections").then((m) => m.StepsRail));
export const Comparison = dynamic(() => import("./Sections").then((m) => m.Comparison));
export const ExampleMarquee = dynamic(() => import("./Sections").then((m) => m.ExampleMarquee));
export const TrustGrid = dynamic(() => import("./Sections").then((m) => m.TrustGrid));
export const FinalCta = dynamic(() => import("./Sections").then((m) => m.FinalCta));
export const SectionHead = dynamic(() => import("./Sections").then((m) => m.SectionHead));
