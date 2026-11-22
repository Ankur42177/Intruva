import { cn } from "@/lib/cn";

/** Intruva mark: two converging strokes (intent → structure) inside a glass drop. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <defs>
        <linearGradient id="lg-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9d3ff" />
          <stop offset="0.5" stopColor="#9d8fff" />
          <stop offset="1" stopColor="#5ce1e6" />
        </linearGradient>
        <radialGradient id="lg-b" cx="0.3" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="10" fill="url(#lg-a)" opacity="0.16" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="9.5" fill="none" stroke="url(#lg-a)" strokeOpacity="0.55" />
      <path d="M9 9.5 L16 22.5 L23 9.5" fill="none" stroke="url(#lg-a)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="9.5" r="1.9" fill="#eef0f7" />
      <rect x="1" y="1" width="30" height="30" rx="10" fill="url(#lg-b)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[1.05rem] font-semibold tracking-[-0.02em] text-fg">Intruva</span>
    </span>
  );
}
