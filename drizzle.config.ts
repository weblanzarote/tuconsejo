import path from "path";
import { defineConfig } from "drizzle-kit";

// SQLite (misma ruta que server/db.ts). Para drizzle-kit generate/studio en local.
const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "consejo.db");

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
});
