import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({
  path: ".env.local",
});

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./lib/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: "postgresql://postgres.nyzxtvrghxurxiutfpam:QDaGs3pMUKE9sNLj@@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
  },
});
