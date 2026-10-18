import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    env: { DATABASE_URL: "file:./test.db", STORAGE_DIR: "./test-storage" },
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
