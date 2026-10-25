-- Isolated benchmark table; does not modify AskDSA's problems table.
DROP TABLE IF EXISTS problems_search_benchmark;

CREATE TABLE problems_search_benchmark (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL,
    slug text NOT NULL,
    difficulty text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Generate 100,000 deterministic synthetic records.
INSERT INTO
    problems_search_benchmark (title, slug, difficulty)
SELECT
    CASE
        WHEN g % 1000 = 0 THEN 'Two Sum Variant ' || g
        ELSE 'Synthetic Problem ' || g
    END,
    CASE
        WHEN g % 1000 = 0 THEN 'two-sum-variant-' || g
        ELSE 'synthetic-problem-' || g
    END,
    CASE
        WHEN g % 3 = 0 THEN 'easy'
        WHEN g % 3 = 1 THEN 'medium'
        ELSE 'hard'
    END
FROM generate_series (1, 100000) AS g;

ANALYZE problems_search_benchmark;

-- Baseline: substring search without a trigram index.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, slug
FROM problems_search_benchmark
WHERE
    title ILIKE '%two%'
    OR slug ILIKE '%two%'
ORDER BY created_at DESC, id
LIMIT 20;

-- Enable the extension only in the development database.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add trigram indexes to the benchmark table only.
CREATE INDEX problems_search_benchmark_title_trgm_idx ON problems_search_benchmark USING gin (title gin_trgm_ops);

CREATE INDEX problems_search_benchmark_slug_trgm_idx ON problems_search_benchmark USING gin (slug gin_trgm_ops);

ANALYZE problems_search_benchmark;

-- Same query after indexing.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, slug
FROM problems_search_benchmark
WHERE
    title ILIKE '%two%'
    OR slug ILIKE '%two%'
ORDER BY created_at DESC, id
LIMIT 20;