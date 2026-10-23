import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-[#e7ebe5]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="AskDSA home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#183d31] font-mono text-sm font-bold text-white">
            A/
          </span>
          <span className="text-xl font-bold tracking-tight">AskDSA</span>
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-5 text-sm">
          <a href="#patterns" className="hidden text-[#647269] transition hover:text-[#183d31] sm:inline">
            Explore patterns
          </a>
          <span className="rounded-full border border-[#dce5db] bg-white px-3 py-1.5 text-xs font-medium text-[#41634f]">
            Built for understanding
          </span>
        </nav>
      </div>
    </header>
  );
}
