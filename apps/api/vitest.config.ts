import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const configDir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(configDir, ".env.test");

const result = config({
  path: envPath,
  override: true,
});

if (result.error) {
  throw new Error(`Unable to load test environment file: ${envPath}`, {
    cause: result.error,
  });
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for API tests");
}

const parsedUrl = new URL(databaseUrl);

if (parsedUrl.pathname !== "/askdsa_test") {
  throw new Error("API tests may only run against the askdsa_test database");
}

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
  resolve: {
    alias: {
      "@askdsa/db/schema": resolve(
        configDir,
        "../../packages/db/src/schema.ts",
      ),
    },
  },
});
