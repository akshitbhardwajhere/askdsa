import { count, desc } from "drizzle-orm";
import { Router } from "express";
import { validateQuery } from "../middleware/validate.js";
import { listProblemsQuerySchema } from "../schemas/problem.js";

export const problemsRouter = Router();

problemsRouter.get(
  "/",
  validateQuery(listProblemsQuerySchema),
  async (_req, res) => {
    const { page, limit } = res.locals.validatedQuery;
    const offset = (page - 1) * limit;

    const { db } = await import("../db/index.js");
    const { problems: problemsTable } = await import("../db/schema.js");

    const [items, countResult] = await Promise.all([
      db
        .select({
          id: problemsTable.id,
          title: problemsTable.title,
          slug: problemsTable.slug,
          difficulty: problemsTable.difficulty,
          tags: problemsTable.tags,
        })
        .from(problemsTable)
        .orderBy(desc(problemsTable.createdAt), problemsTable.id)
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(problemsTable),
    ]);

    const total = countResult[0]?.total ?? 0;

    res.status(200).json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
);
