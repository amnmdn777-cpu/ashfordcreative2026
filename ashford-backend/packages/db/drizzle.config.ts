import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // Paths are resolved relative to the current working directory (the backend
  // root, /app in the container), NOT this config file — the db:* scripts run
  // `drizzle-kit --config packages/db/drizzle.config.ts` from the backend root.
  schema: "./packages/db/src/schema/index.ts",
  out: "./packages/db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
