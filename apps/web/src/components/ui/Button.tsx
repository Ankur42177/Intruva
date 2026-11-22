"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "group/btn relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium " +
  "transition-[transform,background-color,box-shadow,color,opacity] duration-200 ease-[var(--ease-out-expo)] " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  primary:
    "text-ink-950 bg-[linear-gradient(135deg,var(--color-iris-300),var(--color-iris-400)_35%,var(--color-aqua-400))] " +
    "shadow-[0_0_0_1px_rgb(255_255_255/0.25)_inset,0_10px_30px_-10px_rgb(127_108_255/0.8),0_0_40px_-8px_rgb(92_225_230/0.45)] " +
    "hover:shadow-[0_0_0_1px_rgb(255_255_255/0.35)_inset,0_14px_36px_-10px_rgb(127_108_255/0.95),0_0_56px_-6px_rgb(92_225_230/0.6)] hover:-translate-y-px",
  secondary:
    "text-fg glass-subtle hover:bg-white/[0.07] hover:border-white/15",
  ghost: "text-fg-soft hover:text-fg hover:bg-white/[0.05]",
  quiet: "text-fg-muted hover:text-fg",
  danger: "text-[#ffd5cf] bg-risk-soft border border-risk/30 hover:bg-risk/20",
};

const sizes: Record<Size, string> = {
  sm: "h-9 min-w-9 rounded-[0.7rem] px-3 text-[0.8125rem]",
  md: "h-11 min-w-11 rounded-[0.85rem] px-4 text-sm",
  lg: "h-13 min-w-13 rounded-[1rem] px-6 text-[0.95rem]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, iconRight, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  icon,
  iconRight,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  icon?: ReactNode;
  iconRight?: ReactNode;
}) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}
