import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "32kb" }));

app.use(
  pinoHttp({
    level:
      env.NODE_ENV === "test"
        ? "silent"
        : env.NODE_ENV === "production"
          ? "info"
          : "debug",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
      ],
      censor: "[REDACTED]",
    },
  }),
);

app.get("/", (_req, res) => {
  res.status(200).json({
    service: "askdsa-api",
    version: "0.1.0",
  });
});

app.use("/health", healthRouter);

app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  });
});
