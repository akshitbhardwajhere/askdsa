import { dsaTopics } from "../data/topics";

export function TopicGrid() {
  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dsaTopics.map((topic, index) => (
          <article
            key={topic.id}
            className="group flex items-center gap-4 rounded-2xl border border-[#e4e9e2] bg-[#fcfdfa] p-5 transition hover:border-[#b5cbb7] hover:bg-[#f6faf5]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#eaf1e8] font-mono text-sm font-semibold text-[#41634f] transition group-hover:bg-[#183d31] group-hover:text-white">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-[#26372d]">
                {topic.name}
              </span>
              <span className="mt-1 block text-xs text-[#849087]">
                {topic.countLabel}
              </span>
              <span className="mt-2 block text-sm leading-5 text-[#78837b]">
                {topic.description}
              </span>
            </span>
          </article>
        ))}
      </div>
      <p className="mt-5 text-xs leading-5 text-[#929d94]">
        Topic counts are illustrative placeholders and will be replaced with
        curated content.
      </p>
    </>
  );
}
