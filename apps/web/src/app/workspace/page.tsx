import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Workspace } from "@/components/workspace/Workspace";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Diagnose, clarify, and optimize a prompt. Runs on your device in demo mode.",
};

export default function WorkspacePage() {
  return (
    <>
      <Suspense fallback={<WorkspaceSkeleton />}>
        <Workspace />
      </Suspense>
      <SiteFooter />
    </>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-16" aria-hidden>
      <div className="skeleton h-10 w-2/3" />
      <div className="skeleton mt-6 h-64 w-full rounded-3xl" />
    </div>
  );
}
