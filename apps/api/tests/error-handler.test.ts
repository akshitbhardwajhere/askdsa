
import { describe, expect, it } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../src/middleware/error-handler.js";

function createResponse() {
  const response = {
    headersSent: false,
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response;
}

describe("errorHandler", () => {
  it("returns a generic 500 without exposing internal error details", () => {
    const response = createResponse();

    errorHandler(
      new Error("database password leaked"),
      {} as Request,
      response as unknown as Response,
      (() => undefined) as NextFunction,
    );

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(
      "database password leaked",
    );
  });

  it("returns a 400 for malformed JSON", () => {
    const response = createResponse();
    const error = Object.assign(new SyntaxError("Unexpected token"), {
      type: "entity.parse.failed",
    });

    errorHandler(
      error,
      {} as Request,
      response as unknown as Response,
      (() => undefined) as NextFunction,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON",
      },
    });
  });
});
