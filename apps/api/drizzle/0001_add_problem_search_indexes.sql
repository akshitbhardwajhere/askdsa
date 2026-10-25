CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX "problems_title_trgm_idx" ON "problems" USING gin ("title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "problems_slug_trgm_idx" ON "problems" USING gin ("slug" gin_trgm_ops);
