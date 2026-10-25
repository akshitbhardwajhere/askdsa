import { z } from "zod";

export const problemSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  tags: z.array(z.string().trim().min(1)),
});

const cursorPayloadSchema = z
  .object({
    createdAt: z.string().datetime({ offset: true }),
    id: z.string().min(1).max(200),
  })
  .strict();

export function encodeProblemCursor(payload: {
  createdAt: string;
  id: string;
}): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeProblemCursor(cursor: string) {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(decoded);
    return cursorPayloadSchema.parse(parsed);
  } catch {
    return null;
  }
}


export const listProblemsQuerySchema = z
  .object({
    mode: z.enum(["offset", "cursor"]).default("offset"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(1000).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    tag: z.string().trim().min(1).max(50).optional(),
    search: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((query, ctx) => {
    if (query.mode === "offset" && query.cursor !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["cursor"],
        message: "cursor requires mode=cursor",
      });
    }

    if (query.mode === "cursor" && query.page !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["page"],
        message: "page cannot be combined with cursor pagination",
      });
    }
  });

export type Problem = z.infer<typeof problemSchema>;
export type ListProblemsQuery = z.infer<typeof listProblemsQuerySchema>;
