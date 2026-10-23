import { Router } from "express";
import { problems } from "../data/problems.js";
import { validateQuery } from "../middleware/validate.js";
import { listProblemsQuerySchema } from "../schemas/problem.js";

export const problemsRouter = Router();

problemsRouter.get("/", validateQuery(listProblemsQuerySchema), (_req, res) => {
  const { page, limit } = res.locals.validatedQuery;
  const total = problems.length;
  const start = (page - 1) * limit;
  const items = problems.slice(start, start + limit);

  res.status(200).json({
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
