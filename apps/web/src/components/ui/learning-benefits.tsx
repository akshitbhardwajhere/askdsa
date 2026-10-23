const benefits = [
  {
    number: "01 / LEARN",
    title: "Understand the pattern",
    description: "Learn when and why a technique applies.",
  },
  {
    number: "02 / REASON",
    title: "Build your intuition",
    description: "Work through the logic, edge cases, and trade-offs.",
  },
  {
    number: "03 / APPLY",
    title: "Solve independently",
    description: "Turn understanding into repeatable problem-solving skills.",
  },
];

export function LearningBenefits() {
  return (
    <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-3 sm:mt-20 sm:grid-cols-3">
      {benefits.map((benefit) => (
        <article
          key={benefit.number}
          className="rounded-2xl border border-[#e4e9e2] bg-white p-5"
        >
          <span className="font-mono text-xs text-[#70947a]">
            {benefit.number}
          </span>
          <h2 className="mt-3 font-semibold">{benefit.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#78837b]">
            {benefit.description}
          </p>
        </article>
      ))}
    </div>
  );
}
