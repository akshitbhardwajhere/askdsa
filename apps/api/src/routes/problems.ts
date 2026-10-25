import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { Router } from "express";
import { validateQuery } from "../middleware/validate.js";
import {
  decodeProblemCursor,
  encodeProblemCursor,
  listProblemsQuerySchema,
} from "../schemas/problem.js";

export const problemsRouter = Router();

problemsRouter.get(
  "/",
  validateQuery(listProblemsQuerySchema),
  async (_req, res, next) => {
    try {
      const { page, limit, cursor, difficulty, tag, search, mode } =
        res.locals.validatedQuery;

      const cursorPayload = cursor ? decodeProblemCursor(cursor) : null;

      if (cursor && !cursorPayload) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Query parameter validation failed",
            issues: [
              {
                path: "cursor",
                message: "Invalid cursor",
              },
            ],
          },
        });
        return;
      }

      const { db } = await import("../db/index.js");
      const { problems: problemsTable } = await import("../db/schema.js");

      const filters: SQL[] = [];

      if (difficulty) {
        filters.push(eq(problemsTable.difficulty, difficulty));
      }

      if (tag) {
        filters.push(sql`${tag} = ANY(${problemsTable.tags})`);
      }

      if (search) {
        const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
        const pattern = `%${escapedSearch}%`;

        filters.push(
          or(
            ilike(problemsTable.title, pattern),
            ilike(problemsTable.slug, pattern),
          )!,
        );
      }

      const whereClause = filters.length ? and(...filters) : undefined;

      const selectFields = {
        id: problemsTable.id,
        title: problemsTable.title,
        slug: problemsTable.slug,
        difficulty: problemsTable.difficulty,
        tags: problemsTable.tags,
        createdAt: problemsTable.createdAt,
      };

      if (mode === "cursor") {
        const cursorCreatedAt = sql<string>`
          to_char(
            ${problemsTable.createdAt} AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          )
        `;

        const rowsQuery = cursorPayload
          ? (() => {
              const sameTimestampQuery = db
                .select({
                  id: problemsTable.id,
                  title: problemsTable.title,
                  slug: problemsTable.slug,
                  difficulty: problemsTable.difficulty,
                  tags: problemsTable.tags,
                  createdAt: problemsTable.createdAt,
                  cursorCreatedAt: cursorCreatedAt.as("cursorCreatedAt"),
                })
                .from(problemsTable)
                .where(
                  and(
                    ...(whereClause ? [whereClause] : []),
                    sql`${problemsTable.createdAt} = ${cursorPayload.createdAt}::timestamptz`,
                    sql`${problemsTable.id} > ${cursorPayload.id}`,
                  ),
                )
                .orderBy(asc(problemsTable.id))
                .limit(limit + 1);

              const olderTimestampQuery = db
                .select({
                  id: problemsTable.id,
                  title: problemsTable.title,
                  slug: problemsTable.slug,
                  difficulty: problemsTable.difficulty,
                  tags: problemsTable.tags,
                  createdAt: problemsTable.createdAt,
                  cursorCreatedAt: cursorCreatedAt.as("cursorCreatedAt"),
                })
                .from(problemsTable)
                .where(
                  and(
                    ...(whereClause ? [whereClause] : []),
                    sql`${problemsTable.createdAt} < ${cursorPayload.createdAt}::timestamptz`,
                  ),
                )
                .orderBy(desc(problemsTable.createdAt), asc(problemsTable.id))
                .limit(limit + 1);

              const candidates = unionAll(
                sameTimestampQuery,
                olderTimestampQuery,
              ).as("cursor_candidates");

              return db
                .select()
                .from(candidates)
                .orderBy(desc(candidates.createdAt), asc(candidates.id))
                .limit(limit + 1);
            })()
          : db
              .select({
                id: problemsTable.id,
                title: problemsTable.title,
                slug: problemsTable.slug,
                difficulty: problemsTable.difficulty,
                tags: problemsTable.tags,
                createdAt: problemsTable.createdAt,
                cursorCreatedAt: cursorCreatedAt.as("cursorCreatedAt"),
              })
              .from(problemsTable)
              .where(whereClause)
              .orderBy(desc(problemsTable.createdAt), asc(problemsTable.id))
              .limit(limit + 1);

        const rows = await rowsQuery;
        const hasMore = rows.length > limit;
        const pageItems = rows.slice(0, limit);
        const lastItem = pageItems.at(-1);

        res.status(200).json({
          data: pageItems.map(
            ({
              createdAt: _createdAt,
              cursorCreatedAt: _cursorCreatedAt,
              ...item
            }) => item,
          ),
          pagination: {
            mode: "cursor",
            limit,
            hasMore,
            nextCursor:
              hasMore && lastItem
                ? encodeProblemCursor({
                    createdAt: lastItem.cursorCreatedAt,
                    id: lastItem.id,
                  })
                : null,
          },
        });
        return;
      }

      const offset = (page - 1) * limit;

      const [items, countResult] = await Promise.all([
        db
          .select(selectFields)
          .from(problemsTable)
          .where(whereClause)
          .orderBy(desc(problemsTable.createdAt), problemsTable.id)
          .limit(limit)
          .offset(offset),

        db.select({ total: count() }).from(problemsTable).where(whereClause),
      ]);

      const total = countResult[0]?.total ?? 0;

      res.status(200).json({
        data: items.map(({ createdAt: _createdAt, ...item }) => item),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
