"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";

const examples = [
  "When should I use sliding window?",
  "Explain the two pointers pattern",
  "How do I recognize a DP problem?",
];

export function SearchForm() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!query.trim()) {
      setStatus("Enter a DSA question to get started.");
      return;
    }

    setStatus(
      "Search UI is ready. The retrieval API and AI answer generation are the next milestone.",
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function selectExample(example: string) {
    setQuery(example);
    setStatus("");
  }

  return (
    <>
      <form onSubmit={handleSearch} className="mt-10 text-left">
        <label htmlFor="dsa-query" className="sr-only">
          Ask a DSA question
        </label>

        <div className="rounded-2xl border border-[#dce4da] bg-white p-2 shadow-[0_12px_45px_-25px_rgba(24,61,49,0.3)] transition focus-within:border-[#7eaa8d]">
          <textarea
            id="dsa-query"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setStatus("");
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about data structures & algorithms..."
            rows={2}
            maxLength={2000}
            className="w-full resize-none bg-transparent px-4 py-3 text-base leading-6 outline-none placeholder:text-[#9aa49c]"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1">
            <span className="px-2 text-xs text-[#929d94]">
              Be curious. Ask why.
            </span>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#183d31] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245440] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#548268]"
            >
              Ask AskDSA
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>

        {status && (
          <p
            role="status"
            className="mt-3 rounded-lg bg-[#edf3ec] px-4 py-3 text-sm leading-6 text-[#41634f]"
          >
            {status}
          </p>
        )}
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <span className="mr-1 text-xs text-[#8a958d]">Try asking</span>

        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => selectExample(example)}
            className="rounded-full border border-[#e0e6de] bg-white px-3 py-2 text-xs text-[#58665d] transition hover:border-[#a5c1a9] hover:text-[#183d31]"
          >
            {example}
          </button>
        ))}
      </div>
    </>
  );
}
