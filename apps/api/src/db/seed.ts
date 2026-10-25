import "dotenv/config";
import { db, pool } from "./index.js";
import { problems } from "@askdsa/db/schema";

const seedProblems = [
  {
    id: "prob_001",
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "easy" as const,
    tags: ["array", "hash-table"],
  },
  {
    id: "prob_002",
    title: "Valid Parentheses",
    slug: "valid-parentheses",
    difficulty: "easy" as const,
    tags: ["string", "stack"],
  },
  {
    id: "prob_003",
    title: "Longest Substring Without Repeating Characters",
    slug: "longest-substring-without-repeating-characters",
    difficulty: "medium" as const,
    tags: ["string", "sliding-window", "hash-table"],
  },
  {
    id: "prob_004",
    title: "Merge K Sorted Lists",
    slug: "merge-k-sorted-lists",
    difficulty: "hard" as const,
    tags: ["linked-list", "heap", "divide-and-conquer"],
  },
];

try {
  await db
    .insert(problems)
    .values(seedProblems)
    .onConflictDoNothing();

  console.log(`Seeded ${seedProblems.length} sample problems.`);
} catch (error) {
  console.error("Failed to seed problems:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
