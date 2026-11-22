/**
 * Quiet aurora background (plan §15.1). Pure CSS, transform-only animation,
 * fixed behind everything, never intercepts pointer events. Drift stops under
 * reduced motion via the global rules in globals.css.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-950">
      {/* base vertical wash */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#141a33_0%,transparent_60%)]" />
      {/* drifting light blooms */}
      <div className="absolute -left-[20%] -top-[25%] h-[75vmax] w-[75vmax] animate-drift-a rounded-full bg-[radial-gradient(circle_at_center,rgb(127_108_255/0.22),transparent_62%)] will-change-transform" />
      <div className="absolute -right-[25%] top-[5%] h-[65vmax] w-[65vmax] animate-drift-b rounded-full bg-[radial-gradient(circle_at_center,rgb(44_198_207/0.14),transparent_60%)] will-change-transform" />
      <div className="absolute -bottom-[35%] left-[15%] h-[60vmax] w-[60vmax] animate-drift-a rounded-full bg-[radial-gradient(circle_at_center,rgb(255_171_125/0.08),transparent_60%)] [animation-delay:-12s] will-change-transform" />
      {/* fine grid for depth */}
      <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.025)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.025)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,#000_20%,transparent_75%)]" />
      {/* grain to avoid gradient banding */}
      <div className="noise absolute inset-0 opacity-[0.035] mix-blend-overlay" />
      {/* bottom vignette to keep content legible */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_120%,rgb(5_6_11/0.9),transparent_60%)]" />
    </div>
  );
}
