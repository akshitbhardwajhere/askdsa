import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { z } from "zod";
import { validateBody } from "../src/middleware/validate.js";

let server: Server;
let baseUrl: string;

const createApp = () => {
  const app = express();

  app.use(express.json());

  app.post(
    "/test",
    validateBody(
      z.object({
        name: z.string().trim().min(1),
        age: z.number().int().positive(),
      }),
    ),
    (_req, res) => {
      res.status(200).json(res.locals.validatedBody);
    },
  );

  return app;
};

beforeAll(async () => {
  server = createApp().listen(0, "127.0.0.1");

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", () => {
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

describe("validateBody", () => {
  it("accepts valid input and returns parsed data", async () => {
    const response = await fetch(`${baseUrl}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "  Akshit  ", age: 21 }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      name: "Akshit",
      age: 21,
    });
  });

  it("rejects invalid input with structured validation errors", async () => {
    const response = await fetch(`${baseUrl}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", age: -1 }),
    });

    expect(response.status).toBe(400);

    const body = await response.json();

    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Request body validation failed");
    expect(body.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "name" }),
        expect.objectContaining({ path: "age" }),
      ]),
    );
  });
});
