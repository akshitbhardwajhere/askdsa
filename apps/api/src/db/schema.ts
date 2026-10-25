import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const problemDifficulty = pgEnum("problem_difficulty", [
  "easy",
  "medium",
  "hard",
]);

export const problems = pgTable(
  "problems",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    difficulty: problemDifficulty("difficulty").notNull(),
    tags: text("tags").array().notNull().default([]),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("problems_title_trgm_idx").using(
      "gin",
      table.title.op("gin_trgm_ops"),
    ),
    index("problems_slug_trgm_idx").using("gin", table.slug.op("gin_trgm_ops")),
  ],
);
