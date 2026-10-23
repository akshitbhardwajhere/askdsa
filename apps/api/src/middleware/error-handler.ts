import type { ErrorRequestHandler } from "express";

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

export const errorHandler: ErrorRequestHandler = (
  error: HttpError,
  _req,
  res,
  _next,
) => {
  if (res.headersSent) {
    _next(error);
    return;
  }

  if (error.type === "entity.parse.failed") {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON",
      },
    });
    return;
  }

  const status = error.statusCode ?? error.status;

  if (status === 413) {
    res.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds the allowed size",
      },
    });
    return;
  }

  if (status === 400) {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Request could not be processed",
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
};
