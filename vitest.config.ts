import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["plugin/**/*.test.ts"],
    environment: "node",
  },
});
