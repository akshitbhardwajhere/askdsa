import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";

const server = createServer(app);

server.listen(env.PORT, env.HOST, () => {
  console.log(`AskDSA API listening on http://${env.HOST}:${env.PORT}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received; shutting down API`);

  server.close((error) => {
    if (error) {
      console.error("Failed to close HTTP server cleanly", error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
