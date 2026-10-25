import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  integer,
  bigint,
  jsonb,
  vector,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
    index("problems_created_at_id_idx").on(
      table.createdAt.desc(),
      table.id.asc(),
    ),
  ],
);


export const repositoryStatus = pgEnum("repository_status", [
  "pending",
  "indexing",
  "ready",
  "failed",
]);

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    defaultBranch: text("default_branch").notNull(),
    indexedCommitSha: text("indexed_commit_sha"),
    status: repositoryStatus("status").notNull().default("pending"),
    lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("repositories_url_unique").on(table.url),
    index("repositories_status_idx").on(table.status),
  ],
);

export const repositoryFiles = pgTable(
  "repository_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    language: text("language"),
    blobSha: text("blob_sha"),
    contentHash: text("content_hash").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("repository_files_repo_path_unique").on(
      table.repositoryId,
      table.path,
    ),
    index("repository_files_content_hash_idx").on(table.contentHash),
  ],
);

export const codeChunks = pgTable(
  "code_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => repositoryFiles.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    startLine: integer("start_line").notNull(),
    endLine: integer("end_line").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingModel: text("embedding_model"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("code_chunks_file_chunk_unique").on(
      table.fileId,
      table.chunkIndex,
    ),
    index("code_chunks_content_hash_idx").on(table.contentHash),
    check(
      "code_chunks_valid_line_range",
      sql`${table.startLine} >= 1 AND ${table.endLine} >= ${table.startLine}`,
    ),
    check(
      "code_chunks_nonempty_content",
      sql`length(trim(${table.content})) > 0`,
    ),
  ],
);
