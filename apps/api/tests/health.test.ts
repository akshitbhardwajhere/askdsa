import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { app } from "../src/app.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", () => {
      server.removeListener("error", reject);

      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Test server failed to bind to a TCP port"));
        return;
      }

      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});

describe("API endpoints", () => {
  it("returns a healthy status", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "askdsa-api",
    });
  });

  it("returns API metadata at the root", async () => {
    const response = await fetch(`${baseUrl}/`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      service: "askdsa-api",
      version: "0.1.0",
    });
  });

  it("returns a consistent JSON error for unknown routes", async () => {
    const response = await fetch(`${baseUrl}/does-not-exist`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    });
  });

  it("sets security headers", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });

  it("allows the configured frontend origin", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: {
        Origin: "http://localhost:3000",
      },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
  });

  it("does not grant CORS access to an untrusted origin", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: {
        Origin: "https://untrusted.example",
      },
    });

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns a consistent error for malformed JSON", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: '{"invalid":',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON",
      },
    });
  });
});
