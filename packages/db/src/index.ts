import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });

export * from "./schema.js";
