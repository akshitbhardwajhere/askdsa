import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { app } from "../src/app.js";

describe("GET /api/problems", () => {
  let server: Server | undefined;
  let baseUrl: string;

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

    const response = await fetch(
      `${baseUrl}/api/problems?page=1&limit=2`,
    );
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
});
