CREATE INDEX "problems_created_at_id_idx" ON "problems" USING btree ("created_at" DESC NULLS LAST,"id");
