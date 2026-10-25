-- WARNING: Re-running this script drops and recreates only
-- the dedicated pagination_benchmark table.

DROP TABLE IF EXISTS public.pagination_benchmark;

CREATE TABLE public.pagination_benchmark (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL,
    created_at timestamptz NOT NULL
);

-- 100,000 rows; ten rows share each timestamp to test tie-breaking.
INSERT INTO public.pagination_benchmark
    pagination_benchmark (title, created_at)
SELECT 'Synthetic Problem ' || g, timestamptz '2026-01-01 00:00:00+00' - (
        ((g - 1) / 10) * interval '1 second'
    )
FROM generate_series (1, 100000) AS g;

ANALYZE pagination_benchmark;

-- Deep OFFSET baseline without a pagination index.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, created_at
FROM public.pagination_benchmark
ORDER BY created_at DESC, id ASC
LIMIT 20
OFFSET
    50000;

-- Supporting index for the exact sort order.
CREATE INDEX pagination_benchmark_cursor_idx ON public.pagination_benchmark (created_at DESC, id ASC);

ANALYZE pagination_benchmark;

-- Deep OFFSET with the supporting index.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, created_at
FROM public.pagination_benchmark
ORDER BY created_at DESC, id ASC
LIMIT 20
OFFSET
    50000;

-- Cursor query: continue after the row at offset 49,999.
-- The anchor is id=50000, at the timestamp for its group.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, created_at
FROM public.pagination_benchmark
WHERE
    created_at < timestamptz '2026-01-01 00:00:00+00' - interval '4999 seconds'
    OR (
        created_at = timestamptz '2026-01-01 00:00:00+00' - interval '4999 seconds'
        AND id > 50000
    )
ORDER BY created_at DESC, id ASC
LIMIT 20;

-- Optimized cursor query using separate index-friendly branches.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, created_at
FROM (
        (
            SELECT id, title, created_at
            FROM public.pagination_benchmark
            WHERE
                created_at = timestamptz '2026-01-01 00:00:00+00' - interval '4999 seconds'
                AND id > 50000
            ORDER BY id ASC
            LIMIT 20
        )
        UNION ALL
        (
            SELECT id, title, created_at
            FROM public.pagination_benchmark
            WHERE
                created_at < timestamptz '2026-01-01 00:00:00+00' - interval '4999 seconds'
            ORDER BY created_at DESC, id ASC
            LIMIT 20
        )
    ) AS cursor_candidates
ORDER BY created_at DESC, id ASC
LIMIT 20;