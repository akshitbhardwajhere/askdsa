import type { RequestHandler } from "express";
import type { z } from "zod";

export function validateBody<TSchema extends z.ZodType>(
  schema: TSchema,
): RequestHandler<
  Record<string, string>,
  unknown,
  unknown,
  Record<string, string | string[] | undefined>,
  { validatedBody: z.output<TSchema> }
> {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request body validation failed",
          issues: result.error.issues.map((issue) => ({
            path: issue.path.map(String).join("."),
            message: issue.message,
          })),
        },
      });
      return;
    }

    res.locals.validatedBody = result.data;
    next();
  };
}

export function validateQuery<TSchema extends z.ZodType>(
  schema: TSchema,
): RequestHandler<
  Record<string, string>,
  unknown,
  unknown,
  Record<string, string | string[] | undefined>,
  { validatedQuery: z.output<TSchema> }
> {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Query parameter validation failed",
          issues: result.error.issues.map((issue) => ({
            path: issue.path.map(String).join("."),
            message: issue.message,
          })),
        },
      });
      return;
    }

    res.locals.validatedQuery = result.data;
    next();
  };
}
