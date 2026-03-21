import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// drizzle-kit doesn't load .env.local automatically (Next.js does).
config({ path: ".env.local" });

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Supabase requires SSL — append the param if not already present.
    url: process.env.DATABASE_URL!.includes("sslmode")
      ? process.env.DATABASE_URL!
      : `${process.env.DATABASE_URL!}?sslmode=require`,
  },
} satisfies Config;
