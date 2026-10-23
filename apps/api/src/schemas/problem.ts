import { z } from "zod";

export const problemSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  tags: z.array(z.string().trim().min(1)),
});

export const listProblemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type Problem = z.infer<typeof problemSchema>;
export type ListProblemsQuery = z.infer<typeof listProblemsQuerySchema>;
