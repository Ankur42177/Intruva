import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-display text-7xl italic text-aurora">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-fg">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-fg-muted">But your next prompt could be a lot better.</p>
      <Link
        href="/workspace/"
        className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--color-iris-300),var(--color-iris-500)_55%,var(--color-iris-600))] px-5 text-sm font-medium text-white"
      >
        Open the workspace <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
