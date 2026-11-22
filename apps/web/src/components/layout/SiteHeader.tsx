"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, Sparkles, Wind, WindArrowDown, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ButtonLink } from "../ui/Button";
import { Logo } from "./Logo";
import { useMotionPref } from "./MotionPrefs";
import { EngineIndicator } from "./PrivacyIndicator";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#examples", label: "Examples" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const inApp = pathname.startsWith("/workspace");
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const { setPref, animate, osReduced } = useMotionPref();
  const toggleMotion = () => setPref(animate ? "reduced" : "full");
  const motionTitle = animate
    ? "Animations on. Click to reduce motion"
    : osReduced
      ? "Reduced motion (from your system setting). Click to turn animations on"
      : "Reduced motion. Click to turn animations on";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
  }, [menu]);

  const closeMenu = () => setMenu(false);

  return (
    <>
      <a
        href="#main"
        className="fixed left-4 top-3 z-[200] -translate-y-20 rounded-lg bg-iris-500 px-3 py-2 text-sm font-medium text-white focus:translate-y-0"
      >
        Skip to content
      </a>
      <header
        className={cn(
          "sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300",
          scrolled || inApp
            ? "border-b border-white/[0.06] bg-ink-950/55 backdrop-blur-xl backdrop-saturate-150"
            : "border-b border-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="rounded-lg" aria-label="Intruva home">
            <Logo />
          </Link>

          <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
            {NAV.map((n) => {
              const active = n.href === pathname;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-[0.8125rem] transition-colors",
                    active ? "text-fg" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMotion}
              aria-pressed={animate}
              title={motionTitle}
              className={cn(
                "hidden h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors sm:inline-flex",
                animate
                  ? "border-white/10 text-fg-muted hover:text-fg"
                  : "border-warn/30 bg-warn-soft text-warn hover:bg-warn/15",
              )}
            >
              {animate ? <Wind className="size-4" aria-hidden /> : <WindArrowDown className="size-4" aria-hidden />}
              <span className="hidden lg:inline">{animate ? "Motion on" : "Motion off"}</span>
              <span className="sr-only lg:hidden">Animations</span>
            </button>
            {inApp ? (
              <EngineIndicator />
            ) : (
              <ButtonLink
                href="/workspace"
                variant="primary"
                size="sm"
                className="hidden sm:inline-flex"
                icon={<Sparkles className="size-3.5" aria-hidden />}
              >
                Open workspace
              </ButtonLink>
            )}
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-xl text-fg-soft hover:bg-white/[0.06] md:hidden"
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}
            >
              {menu ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menu && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-16 z-30 bg-ink-950/80 backdrop-blur-2xl md:hidden"
          >
            <m.nav
              aria-label="Mobile"
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-1 p-4"
            >
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={closeMenu}
                  className="rounded-xl px-4 py-3.5 text-lg text-fg-soft hover:bg-white/[0.05] hover:text-fg"
                >
                  {n.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={toggleMotion}
                aria-pressed={animate}
                className="flex items-center justify-between rounded-xl px-4 py-3.5 text-left text-lg text-fg-soft hover:bg-white/[0.05]"
              >
                Animations
                <span className={cn("text-sm", animate ? "text-aqua-300" : "text-warn")}>{animate ? "On" : "Off"}</span>
              </button>
              <ButtonLink
                href="/workspace"
                variant="primary"
                size="lg"
                className="mt-4"
                iconRight={<ArrowRight className="size-4" aria-hidden />}
              >
                Open workspace
              </ButtonLink>
            </m.nav>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
