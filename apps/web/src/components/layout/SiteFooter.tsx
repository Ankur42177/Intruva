import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-white/[0.06]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-fg-muted">
            Prompt intelligence: diagnose what&apos;s missing, keep what you meant, and catch risks before you hit send.
          </p>
          <p className="mt-4 text-xs text-fg-faint">
            Preview build. Scores are heuristic coverage indicators, not guarantees of output quality or safety.
          </p>
        </div>
        <FooterCol
          title="Product"
          links={[
            ["/workspace", "Workspace"],
            ["/#features", "Features"],
            ["/#examples", "Examples"],
          ]}
        />
        <FooterCol
          title="Trust"
          links={[
            ["/privacy", "Privacy & data"],
            ["/privacy#scan", "What the scan covers"],
          ]}
        />
        <FooterCol
          title="Coming next"
          links={[
            ["/privacy#roadmap", "Browser extension"],
            ["/privacy#roadmap", "Developer API"],
          ]}
        />
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-fg-faint">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map(([href, label]) => (
          <li key={label}>
            <Link href={href} className="text-sm text-fg-muted transition-colors hover:text-fg">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
