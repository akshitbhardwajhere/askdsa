import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { app } from "../src/app.js";
import { db, pool } from "../src/db/index.js";
import { problems } from "../src/db/schema.js";
import { inArray } from "drizzle-orm";

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
});
