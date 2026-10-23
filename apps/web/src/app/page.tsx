import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { LearningBenefits } from "@/components/ui/learning-benefits";
import { TopicGrid } from "@/features/patterns/components/topic-grid";
import { SearchForm } from "@/features/search/components/search-form";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f9f6] text-[#17251f]">
      <SiteHeader />

      <section className="mx-auto max-w-5xl px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dce5db] bg-white px-3.5 py-2 text-xs font-medium text-[#41634f]">
            <span className="h-2 w-2 rounded-full bg-[#4b9368]" />
            Learn patterns. Build intuition. Solve problems.
          </div>

          <h1 className="text-4xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-6xl">
            Stop memorizing.
            <br />
            <span className="text-[#548268]">Start understanding DSA.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-[#68756d] sm:text-lg">
            Ask questions, uncover problem-solving patterns, and understand why
            an approach works—not just what the solution is.
          </p>

          <SearchForm />
        </div>

        <LearningBenefits />
      </section>

      <section id="patterns" className="border-t border-[#e7ebe5] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-xs tracking-[0.18em] text-[#70947a]">
                YOUR LEARNING MAP
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Explore DSA patterns
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[#78837b]">
                Start with a topic, understand its core technique, and learn how
                to recognize it in unfamiliar problems.
              </p>
            </div>

            <span className="text-sm text-[#8a958d]">
              Start with the fundamentals
            </span>
          </div>

          <TopicGrid />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
