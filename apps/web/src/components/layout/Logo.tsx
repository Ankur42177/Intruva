"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Animated Intruva mark.
 *  - Iridescent rim: a rotating conic-style gradient seen through a ring mask.
 *  - Glass body: frosted fill with a fixed specular highlight.
 *  - The "V" (intent → structure) draws itself in, then a light pulse travels along it.
 *  - Core dot breathes like a status light.
 * All motion is CSS, so it obeys the reduced-motion preference. Hover speeds up the rim.
 */
export function LogoMark({ className, animated = true }: { className?: string; animated?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `${uid}-${n}`;
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={id("rim")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9d3ff" />
          <stop offset="0.3" stopColor="#9d8fff" />
          <stop offset="0.55" stopColor="#5ce1e6" />
          <stop offset="0.8" stopColor="#ffab7d" />
          <stop offset="1" stopColor="#d9d3ff" />
        </linearGradient>
        <linearGradient id={id("v")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef0f7" />
          <stop offset="0.5" stopColor="#bcb2ff" />
          <stop offset="1" stopColor="#5ce1e6" />
        </linearGradient>
        <radialGradient id={id("body")} cx="0.32" cy="0.22" r="0.95">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#9d8fff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#0a0c14" stopOpacity="0.9" />
        </radialGradient>
        <mask id={id("ring")}>
          <rect x="1" y="1" width="30" height="30" rx="10" fill="white" />
          <rect x="2.4" y="2.4" width="27.2" height="27.2" rx="8.7" fill="black" />
        </mask>
        <filter id={id("glow")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {/* glass body */}
      <rect x="1" y="1" width="30" height="30" rx="10" fill={`url(#${id("body")})`} />
      {/* rotating iridescent rim */}
      <g mask={`url(#${id("ring")})`}>
        <rect x="-8" y="-8" width="48" height="48" fill={`url(#${id("rim")})`} className={animated ? "logo-rim" : undefined} />
      </g>
      {/* the mark */}
      <path
        d="M9.5 10 L16 22 L22.5 10"
        fill="none"
        stroke={`url(#${id("v")})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animated ? "logo-draw" : undefined}
      />
      {/* travelling light pulse */}
      {animated && (
        <path
          d="M9.5 10 L16 22 L22.5 10"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${id("glow")})`}
          className="logo-trace"
        />
      )}
      {/* core */}
      <circle cx="16" cy="9.6" r="2.6" fill="#5ce1e6" opacity="0.35" filter={`url(#${id("glow")})`} className={animated ? "logo-core" : undefined} />
      <circle cx="16" cy="9.6" r="1.7" fill="#eef0f7" />
      {/* specular highlight */}
      <path d="M6 7.5 Q9 4.2 14 4" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, animated = true }: { className?: string; animated?: boolean }) {
  return (
    <span className={cn("group inline-flex items-center gap-2.5", className)}>
      <LogoMark animated={animated} />
      <span className="text-[1.08rem] font-semibold tracking-[-0.02em] text-fg">Intruva</span>
    </span>
  );
}
