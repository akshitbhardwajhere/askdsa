import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { app } from "../src/app.js";
import { db, pool } from "../src/db/index.js";
import { problems } from "@askdsa/db/schema";
import { inArray, sql } from "drizzle-orm";

const testProblems = [
  {
    id: "test_prob_001",
    title: "Test Two Sum",
    slug: "test-two-sum",
    difficulty: "easy" as const,
    tags: ["array", "hash-table"],
  },
  {
    id: "test_prob_002",
    title: "Test Valid Parentheses",
    slug: "test-valid-parentheses",
    difficulty: "easy" as const,
    tags: ["string", "stack"],
  },
  {
    id: "test_prob_003",
    title: "Test Longest Substring",
    slug: "test-longest-substring",
    difficulty: "medium" as const,
    tags: ["string", "sliding-window"],
  },
  {
    id: "test_prob_004",
    title: "Test Merge K Lists",
    slug: "test-merge-k-lists",
    difficulty: "hard" as const,
    tags: ["linked-list", "heap"],
  },
];

async function assertTestDatabase(): Promise<void> {
  const result = await pool.query("SELECT current_database() AS name");

  if (result.rows[0]?.name !== "askdsa_test") {
    throw new Error("Refusing to modify data: API tests must use askdsa_test");
  }
}

describe("GET /api/problems", () => {
  let server: Server | undefined;
  let baseUrl: string;

  beforeEach(async () => {
    await assertTestDatabase();

    // The dedicated test database may be reset between test cases.
    await db.delete(problems).where(
      // Only remove rows created by this test suite.
      // Keep this list aligned with testProblems above.
      inArray(
        problems.id,
        testProblems.map((problem) => problem.id),
      ),
    );
    await db.insert(problems).values(testProblems);
  });

  afterEach(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }

    server = undefined;

    await assertTestDatabase();
    await db.delete(problems).where(
      // Only remove rows created by this test suite.
      // Keep this list aligned with testProblems above.
      inArray(
        problems.id,
        testProblems.map((problem) => problem.id),
      ),
    );
  });

  async function startServer() {
    server = createServer(app);

    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  it("returns problems with default pagination", async () => {
    await startServer();

    const response = await fetch(`${baseUrl}/api/problems`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(4);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 4,
      totalPages: 1,
    });
  });

  it("applies requested pagination", async () => {
    await startServer();

    const response = await fetch(`${baseUrl}/api/problems?page=1&limit=2`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 4,
      totalPages: 2,
    });
  });

  it("returns the first cursor-paginated page without a cursor", async () => {
    await startServer();

    const response = await fetch(`${baseUrl}/api/problems?mode=cursor&limit=2`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toMatchObject({
      mode: "cursor",
      limit: 2,
      hasMore: true,
    });
    expect(body.pagination.nextCursor).toEqual(expect.any(String));
  });

  it("traverses all problems with cursor pagination without duplicates", async () => {
    await startServer();

    const collectedIds: string[] = [];
    let cursor: string | null = null;

    do {
      const query = new URLSearchParams({
        mode: "cursor",
        limit: "2",
      });

      if (cursor) {
        query.set("cursor", cursor);
      }

      const response = await fetch(
        `${baseUrl}/api/problems?${query.toString()}`,
      );
      const body = await response.json();

      expect(response.status).toBe(200);

      collectedIds.push(
        ...body.data.map((problem: { id: string }) => problem.id),
      );

      cursor = body.pagination.nextCursor;
    } while (cursor);

    expect(collectedIds).toHaveLength(4);
    expect(new Set(collectedIds).size).toBe(4);
    expect(new Set(collectedIds)).toEqual(
      new Set(testProblems.map((problem) => problem.id)),
    );
  });

  it("returns 400 for an invalid cursor", async () => {
    await startServer();

    const response = await fetch(
      `${baseUrl}/api/problems?mode=cursor&cursor=not-a-valid-cursor`,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["empty object", "e30"],
    ["null payload", "bnVsbA"],
    ["invalid timestamp", "eyJjcmVhdGVkQXQiOiJub3QtYS1kYXRlIiwiaWQiOiJ4In0"],
    [
      "unexpected field",
      Buffer.from(
        JSON.stringify({
          createdAt: "2026-01-01T10:00:00.000Z",
          id: "test_prob_001",
          extra: true,
        }),
      ).toString("base64url"),
    ],
  ])("returns 400 for a cursor with %s", async (_caseName, cursor) => {
    await startServer();

    const response = await fetch(
      `${baseUrl}/api/problems?mode=cursor&cursor=${encodeURIComponent(cursor)}`,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("does not return a next cursor when there are no more results", async () => {
    await startServer();

    const response = await fetch(
      `${baseUrl}/api/problems?mode=cursor&limit=50`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(4);
    expect(body.pagination.hasMore).toBe(false);
    expect(body.pagination.nextCursor).toBeNull();
  });

  it.each([
    ["page", "0"],
    ["limit", "100"],
  ])("returns 400 when %s=%s is invalid", async (parameter, value) => {
    await startServer();

    const response = await fetch(
      `${baseUrl}/api/problems?${parameter}=${value}`,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each(["mode=offset&cursor=abc", "mode=cursor&page=2"])(
    "rejects incompatible pagination query: %s",
    async (query) => {
      await startServer();

      const response = await fetch(`${baseUrl}/api/problems?${query}`);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    },
  );

  it("filters problems by difficulty", async () => {
    await startServer();

    const response = await fetch(`${baseUrl}/api/problems?difficulty=easy`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(
      body.data.every(
        (problem: { difficulty: string }) => problem.difficulty === "easy",
      ),
    ).toBe(true);
    expect(body.pagination.total).toBe(2);
    expect(body.pagination.totalPages).toBe(1);
  });

  it("filters by an exact tag", async () => {
    await startServer();

    const response = await fetch(`${baseUrl}/api/problems?tag=array`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].slug).toBe("test-two-sum");
    expect(body.pagination.total).toBe(1);
  });

  it("combines difficulty and tag filters", async () => {
    await startServer();

    const response = await fetch(
      `${baseUrl}/api/problems?difficulty=easy&tag=string`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].slug).toBe("test-valid-parentheses");
    expect(body.pagination.total).toBe(1);
  });

  it("calculates pagination totals after filtering", async () => {
    await startServer();

    const response = await fetch(
      `${baseUrl}/api/problems?difficulty=easy&limit=1&page=2`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it.each([
    ["difficulty", "expert"],
    ["tag", "   "],
  ])("rejects invalid %s filter", async (parameter, value) => {
    await startServer();

    const response = await fetch(
      `${baseUrl}/api/problems?${parameter}=${encodeURIComponent(value)}`,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("does not match partial tags", async () => {
    await startServer();

    const response = await fetch(`${baseUrl}/api/problems?tag=arr`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
    expect(body.pagination.totalPages).toBe(0);
  });

  it("searches problem titles and slugs case-insensitively", async () => {
    await startServer();

    const response = await fetch(`${baseUrl}/api/problems?search=TWO`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].slug).toBe("test-two-sum");
    expect(body.pagination.total).toBe(1);
  });

  it("combines search with difficulty and pagination", async () => {
    await startServer();

    const response = await fetch(
      `${baseUrl}/api/problems?search=test&difficulty=easy&limit=1`,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it("rejects an empty search parameter", async () => {
    await startServer();

    const response = await fetch(
      `${baseUrl}/api/problems?search=${encodeURIComponent("   ")}`,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("traverses cursor pages correctly with filters applied", async () => {
    await startServer();

    const collectedSlugs: string[] = [];
    let cursor: string | null = null;

    do {
      const query = new URLSearchParams({
        mode: "cursor",
        limit: "1",
        difficulty: "easy",
      });

      if (cursor) {
        query.set("cursor", cursor);
      }

      const response = await fetch(
        `${baseUrl}/api/problems?${query.toString()}`,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      collectedSlugs.push(
        ...body.data.map((item: { slug: string }) => item.slug),
      );
      cursor = body.pagination.nextCursor;
    } while (cursor);

    expect(collectedSlugs).toHaveLength(2);
    expect(new Set(collectedSlugs).size).toBe(2);
    expect(collectedSlugs).toContain("test-two-sum");
    expect(collectedSlugs).toContain("test-valid-parentheses");
  });

  it("paginates correctly when problems share the same timestamp", async () => {
    await startServer();

    const fixedTimestamp = new Date("2026-01-01T10:00:00.000Z");

    await db
      .update(problems)
      .set({ createdAt: fixedTimestamp })
      .where(
        inArray(
          problems.id,
          testProblems.map((problem) => problem.id),
        ),
      );

    const collectedIds: string[] = [];
    let cursor: string | null = null;

    do {
      const query = new URLSearchParams({
        mode: "cursor",
        limit: "1",
      });

      if (cursor) {
        query.set("cursor", cursor);
      }

      const response = await fetch(
        `${baseUrl}/api/problems?${query.toString()}`,
      );
      const body = await response.json();

      expect(response.status).toBe(200);

      collectedIds.push(
        ...body.data.map((problem: { id: string }) => problem.id),
      );

      cursor = body.pagination.nextCursor;
    } while (cursor);

    expect(collectedIds).toHaveLength(testProblems.length);
    expect(new Set(collectedIds).size).toBe(testProblems.length);

    // PostgreSQL ordering: createdAt DESC, id ASC.
    expect(collectedIds).toEqual(
      [...testProblems.map((problem) => problem.id)].sort(),
    );
  });

  it("preserves microsecond precision in cursor timestamps", async () => {
    await startServer();

    await db.execute(sql`
    UPDATE problems
    SET created_at = CASE id
      WHEN 'test_prob_001' THEN '2026-01-01T10:00:00.123456Z'::timestamptz
      WHEN 'test_prob_002' THEN '2026-01-01T10:00:00.123789Z'::timestamptz
      WHEN 'test_prob_003' THEN '2026-01-01T10:00:00.124001Z'::timestamptz
      WHEN 'test_prob_004' THEN '2026-01-01T10:00:00.124567Z'::timestamptz
    END
    WHERE id IN (
      'test_prob_001',
      'test_prob_002',
      'test_prob_003',
      'test_prob_004'
    )
  `);

    const firstResponse = await fetch(
      `${baseUrl}/api/problems?mode=cursor&limit=1`,
    );
    const firstBody = await firstResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstBody.pagination.nextCursor).toEqual(expect.any(String));

    const secondResponse = await fetch(
      `${baseUrl}/api/problems?mode=cursor&limit=1&cursor=${encodeURIComponent(firstBody.pagination.nextCursor)}`,
    );
    const secondBody = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondBody.data).toHaveLength(1);
    expect(secondBody.data[0].id).not.toBe(firstBody.data[0].id);
  });
});
