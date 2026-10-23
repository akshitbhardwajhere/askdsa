import type { Problem } from "../schemas/problem.js";

export const problems: Problem[] = [
  {
    id: "prob_001",
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "easy",
    tags: ["array", "hash-table"],
  },
  {
    id: "prob_002",
    title: "Valid Parentheses",
    slug: "valid-parentheses",
    difficulty: "easy",
    tags: ["string", "stack"],
  },
  {
    id: "prob_003",
    title: "Longest Substring Without Repeating Characters",
    slug: "longest-substring-without-repeating-characters",
    difficulty: "medium",
    tags: ["string", "sliding-window", "hash-table"],
  },
  {
    id: "prob_004",
    title: "Merge K Sorted Lists",
    slug: "merge-k-sorted-lists",
    difficulty: "hard",
    tags: ["linked-list", "heap", "divide-and-conquer"],
  },
];
