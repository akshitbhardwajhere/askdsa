CREATE TYPE "public"."repository_status" AS ENUM('pending', 'indexing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "code_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL,
	"embedding" vector(1536),
	"embedding_model" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "code_chunks_valid_line_range" CHECK ("code_chunks"."start_line" >= 1 AND "code_chunks"."end_line" >= "code_chunks"."start_line"),
	CONSTRAINT "code_chunks_nonempty_content" CHECK (length(trim("code_chunks"."content")) > 0)
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"default_branch" text NOT NULL,
	"indexed_commit_sha" text,
	"status" "repository_status" DEFAULT 'pending' NOT NULL,
	"last_indexed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repository_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"path" text NOT NULL,
	"language" text,
	"blob_sha" text,
	"content_hash" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"last_indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "code_chunks" ADD CONSTRAINT "code_chunks_file_id_repository_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."repository_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_files" ADD CONSTRAINT "repository_files_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "code_chunks_file_chunk_unique" ON "code_chunks" USING btree ("file_id","chunk_index");--> statement-breakpoint
CREATE INDEX "code_chunks_content_hash_idx" ON "code_chunks" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_url_unique" ON "repositories" USING btree ("url");--> statement-breakpoint
CREATE INDEX "repositories_status_idx" ON "repositories" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "repository_files_repo_path_unique" ON "repository_files" USING btree ("repository_id","path");--> statement-breakpoint
CREATE INDEX "repository_files_content_hash_idx" ON "repository_files" USING btree ("content_hash");
