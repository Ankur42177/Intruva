"use client";

import { AnimatePresence, m, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowRight, CircleCheck, CircleDot, Lock, MousePointerClick, ShieldAlert, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { SAMPLES } from "@/lib/samples";
import { HANDOFF_KEY } from "@/lib/handoff";
import { GlassSculpture } from "./GlassSculpture";

const ACCENTS = ["precise", "context-rich", "secure", "intent-true"];
const TYPED = [
  "Fix this and make it cleaner.",
  "Research this company and tell me if it is good.",
  "Write a good mail to my manager.",
  "Explain operating systems.",
];

export function Hero() {
  const router = useRouter();
  const frame = useRef<HTMLElement>(null);
  const [value, setValue] = useState("");
  const [accent, setAccent] = useState(0);
  const [typed, setTyped] = useState("");
  const [focused, setFocused] = useState(false);
  const [hint, setHint] = useState(true);

  // parallax source (−0.5..0.5), springy
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 18 });
  const sy = useSpring(py, { stiffness: 60, damping: 18 });

  useEffect(() => {
    const t = setInterval(() => setAccent((a) => (a + 1) % ACCENTS.length), 2600);
    return () => clearInterval(t);
  }, []);

  // typewriter placeholder for the prompt bar
  useEffect(() => {
    if (value || focused) return;
    let i = 0;
    let c = 0;
    let dir = 1;
    const tick = setInterval(() => {
      const s = TYPED[i];
      c += dir;
      setTyped(s.slice(0, c));
      if (c >= s.length + 14) dir = -1;
      if (c <= 0 && dir === -1) {
        dir = 1;
        i = (i + 1) % TYPED.length;
      }
    }, 55);
    return () => clearInterval(tick);
  }, [value, focused]);

  const onPointer = (e: React.PointerEvent) => {
    const el = frame.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    px.set(x - 0.5);
    py.set(y - 0.5);
    el.style.setProperty("--spot-x", `${x * 100}%`);
    el.style.setProperty("--spot-y", `${y * 100}%`);
  };

  const go = (text: string) => {
    try {
      sessionStorage.setItem(HANDOFF_KEY, text);
    } catch {
      /* ignore */
    }
    router.push("/workspace/");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) go(value.trim());
    else router.push("/workspace/?sample=debug");
  };

  return (
    <section
      ref={frame}
      onPointerMove={onPointer}
      aria-labelledby="hero-title"
      className="frame-sweep group/hero relative isolate mx-2 mt-2 overflow-hidden rounded-[1.75rem] border border-white/[0.06] bg-ink-950 sm:mx-4 sm:rounded-[2.5rem]"
      style={{ minHeight: "min(calc(100svh - 5rem), 54rem)" }}
    >
      <GlassSculpture onReady={() => setTimeout(() => setHint(false), 6000)} />

      {/* readability scrims (text side) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(5_6_11/0.92)_0%,rgb(5_6_11/0.55)_38%,transparent_62%)] max-md:bg-[linear-gradient(180deg,rgb(5_6_11/0.9)_0%,rgb(5_6_11/0.6)_55%,rgb(5_6_11/0.2)_100%)]" />
      {/* cursor spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/hero:opacity-100"
        style={{ background: "radial-gradient(520px circle at var(--spot-x,50%) var(--spot-y,50%), rgb(157 143 255 / 0.08), transparent 60%)" }}
      />

      {/* floating diagnosis chips (desktop) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
        <FloatChip sx={sx} sy={sy} depth={46} className="right-[30%] top-[22%]" delay={0.9}>
          <CircleDot className="size-3.5 text-warn" /> Missing: expected behaviour
        </FloatChip>
        <FloatChip sx={sx} sy={sy} depth={-34} className="right-[6%] top-[34%]" delay={1.2}>
          <CircleCheck className="size-3.5 text-ok" /> Constraint kept · “don&apos;t change the API”
        </FloatChip>
        <FloatChip sx={sx} sy={sy} depth={60} className="right-[24%] bottom-[22%]" delay={1.5}>
          <ShieldAlert className="size-3.5 text-risk" /> API key detected → redacted
        </FloatChip>
        <FloatChip sx={sx} sy={sy} depth={-52} className="right-[8%] bottom-[12%]" delay={1.8}>
          <Sparkles className="size-3.5 text-aqua-300" /> Coverage 34 → 82
        </FloatChip>
      </div>

      <AnimatePresence>
        {hint && (
          <m.p
            aria-hidden
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 2.2 } }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute bottom-6 right-6 hidden items-center gap-1.5 rounded-full border border-white/10 bg-ink-950/50 px-3 py-1.5 text-xs text-fg-muted backdrop-blur md:flex"
          >
            <MousePointerClick className="size-3.5" /> Move your cursor, or click the glass
          </m.p>
        )}
      </AnimatePresence>

      {/* copy */}
      <div className="pointer-events-none relative z-10 flex min-h-[inherit] flex-col justify-center px-5 py-14 sm:px-10 md:px-14 lg:px-20" style={{ minHeight: "inherit" }}>
        <div className="pointer-events-auto max-w-[40rem]">
          <m.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1.5 pr-3 text-xs text-fg-soft backdrop-blur-md"
          >
            <span className="rounded-full bg-iris-500/25 px-2 py-0.5 text-[0.7rem] font-medium text-iris-200">New</span>
            Prompt intelligence · preflight for AI
          </m.p>

          <h1 id="hero-title" className="mt-6 text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] text-fg sm:text-6xl lg:text-[4.6rem]">
            <WordReveal text="Turn vague prompts" delay={0.1} />
            <br />
            <WordReveal text="into" delay={0.35} />{" "}
            <span className="relative inline-grid align-bottom">
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span
                  key={ACCENTS[accent]}
                  initial={{ opacity: 0, y: "0.45em", filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: "-0.45em", filter: "blur(8px)" }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  className="col-start-1 row-start-1 bg-[linear-gradient(100deg,#c4b8ff,#9d8fff_40%,#6ee7ec)] bg-clip-text font-display italic tracking-[-0.01em] text-transparent"
                >
                  {ACCENTS[accent]}
                </m.span>
              </AnimatePresence>
            </span>
            <br />
            <WordReveal text="AI results." delay={0.55} />
          </h1>

          <m.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-[34rem] text-base leading-relaxed text-fg-soft sm:text-lg"
          >
            Intruva diagnoses what your prompt is missing, keeps every word you meant, and catches secrets before they
            leave your screen.
          </m.p>

          {/* live prompt bar */}
          <m.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "glass-strong mt-8 flex items-center gap-2 rounded-2xl p-1.5 pl-4 transition-shadow duration-300",
              focused && "shadow-[0_0_0_1px_rgb(157_143_255/0.5),0_0_0_6px_rgb(157_143_255/0.12),0_30px_60px_-20px_rgb(0_0_0/0.8)]",
            )}
          >
            <Sparkles className="size-4 shrink-0 text-iris-300" aria-hidden />
            <label htmlFor="hero-prompt" className="sr-only">
              Paste a prompt to optimize
            </label>
            <div className="relative min-w-0 flex-1">
              <input
                id="hero-prompt"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoComplete="off"
                className="h-11 w-full bg-transparent text-[0.95rem] text-fg outline-none"
              />
              {!value && (
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 flex items-center truncate text-[0.95rem] text-fg-faint">
                  {focused ? "Paste or type your prompt…" : typed}
                  {!focused && <span className="ml-px inline-block h-5 w-px animate-caret bg-aqua-400" />}
                </span>
              )}
            </div>
            <MagneticButton type="submit">
              Optimize <ArrowRight className="size-4 transition-transform group-hover/mag:translate-x-0.5" aria-hidden />
            </MagneticButton>
          </m.form>

          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
            className="mt-4 flex flex-wrap items-center gap-2 text-xs text-fg-muted"
          >
            <span>Or try:</span>
            {SAMPLES.filter((s) => ["debug", "write", "secret"].includes(s.id)).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => router.push(`/workspace/?sample=${s.id}`)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-fg-soft backdrop-blur transition-colors hover:border-white/20 hover:text-fg"
              >
                {s.label}
              </button>
            ))}
            <a href="#how" className="ml-1 inline-flex items-center gap-1 text-fg-soft hover:text-fg">
              See how it works <ArrowDown className="size-3" aria-hidden />
            </a>
          </m.div>

          <m.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3, duration: 0.6 }}
            className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-fg-muted"
          >
            <li className="inline-flex items-center gap-1.5">
              <Lock className="size-3.5 text-ok" aria-hidden /> Runs on your device
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CircleCheck className="size-3.5 text-ok" aria-hidden /> Nothing stored
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CircleCheck className="size-3.5 text-ok" aria-hidden /> No signup
            </li>
          </m.ul>
        </div>
      </div>
    </section>
  );
}

function WordReveal({ text, delay = 0 }: { text: string; delay?: number }) {
  const words = text.split(" ");
  return (
    <span className="inline">
      {words.map((w, i) => (
        <span key={i}>
          <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <m.span
              className="inline-block"
              initial={{ y: "110%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.8, delay: delay + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
            >
              {w}
            </m.span>
          </span>
          {/* a real space between word boxes so lines can wrap on small screens */}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

function FloatChip({
  children,
  className,
  sx,
  sy,
  depth,
  delay,
}: {
  children: React.ReactNode;
  className?: string;
  sx: MotionValue<number>;
  sy: MotionValue<number>;
  depth: number;
  delay: number;
}) {
  const x = useTransform(sx, (v) => v * depth);
  const y = useTransform(sy, (v) => v * depth);
  return (
    <m.div style={{ x, y }} className={cn("absolute", className)}>
      <m.div
        initial={{ opacity: 0, scale: 0.85, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className="glass flex animate-float items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-xs text-fg-soft"
          style={{ animationDelay: `${-delay * 2}s` }}
        >
          {children}
        </div>
      </m.div>
    </m.div>
  );
}

function MagneticButton({ children, type = "button" }: { children: React.ReactNode; type?: "button" | "submit" }) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 15 });
  const y = useSpring(0, { stiffness: 220, damping: 15 });
  return (
    <m.button
      ref={ref}
      type={type}
      style={{ x, y }}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * 0.25);
        y.set((e.clientY - (r.top + r.height / 2)) * 0.35);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      whileTap={{ scale: 0.96 }}
      className="group/mag inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--color-iris-300),var(--color-iris-500)_55%,var(--color-iris-600))] px-4 text-sm font-medium text-white shadow-[0_0_0_1px_rgb(255_255_255/0.2)_inset,0_10px_30px_-8px_rgb(127_108_255/0.9)] transition-shadow hover:shadow-[0_0_0_1px_rgb(255_255_255/0.3)_inset,0_14px_40px_-8px_rgb(127_108_255/1),0_0_50px_-10px_rgb(92_225_230/0.6)] sm:px-5"
    >
      {children}
    </m.button>
  );
}
