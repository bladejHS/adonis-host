// Bază SQLite separată pentru teste (packages/database/prisma/test.db), recreată la fiecare rulare.
import { execSync } from "node:child_process";
import path from "node:path";

export default async function setup() {
  execSync("npx prisma db push --force-reset --skip-generate", {
    cwd: path.resolve(__dirname, "../../database"),
    env: { ...process.env, DATABASE_URL: "file:./test.db", PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    stdio: "pipe",
  });
}
