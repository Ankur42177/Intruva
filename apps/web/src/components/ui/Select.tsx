"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

/**
 * Accessible listbox popover (WAI-ARIA "select-only combobox" pattern).
 * Arrow keys / Home / End / type-ahead, Enter/Space to pick, Escape to close.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  renderValue,
  className,
  align = "start",
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  label: string;
  renderValue?: (o: SelectOption<T>) => ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ q: "", t: 0 });
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!btn.current?.contains(e.target as Node) && !list.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const openList = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const pick = (i: number) => {
    onChange(options[i].value);
    setOpen(false);
    btn.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(options.length - 1, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(active);
        break;
      case "Escape":
      case "Tab":
        setOpen(false);
        break;
      default:
        if (e.key.length === 1) {
          const now = Date.now();
          const t = typeahead.current;
          t.q = now - t.t > 600 ? e.key.toLowerCase() : t.q + e.key.toLowerCase();
          t.t = now;
          const i = options.findIndex((o) => o.label.toLowerCase().startsWith(t.q));
          if (i >= 0) setActive(i);
        }
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={btn}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
        className="glass-subtle inline-flex h-10 w-full items-center gap-2 rounded-[0.85rem] pl-3 pr-2.5 text-left text-[0.8125rem] text-fg transition-colors hover:bg-white/[0.06]"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
          {renderValue ? renderValue(selected) : (
            <>
              {selected.icon}
              <span className="truncate">{selected.label}</span>
            </>
          )}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-fg-muted" aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <m.ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "glass-strong absolute z-50 mt-2 max-h-80 w-72 overflow-auto rounded-2xl p-1.5",
              align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
            )}
          >
            {options.map((o, i) => {
              const isSel = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${id}-opt-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(i)}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2 text-[0.8125rem] transition-colors",
                    i === active ? "bg-white/[0.08]" : "",
                  )}
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-fg-muted">{o.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-fg">{o.label}</span>
                    {o.description && <span className="mt-0.5 block text-xs leading-snug text-fg-muted">{o.description}</span>}
                  </span>
                  {isSel && <Check className="mt-0.5 size-4 shrink-0 text-aqua-400" aria-hidden />}
                </li>
              );
            })}
          </m.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
