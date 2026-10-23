import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "Set DRIZZLE_DATABASE_URL or DATABASE_URL before running Drizzle Kit",
  );
}

export default defineConfig({
  schema: "./apps/api/src/db/schema.ts",
  out: "./apps/api/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
  strict: true,
  verbose: true,
});
