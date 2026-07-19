import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["packages/{content,engine,server}/src/**/*.ts"],
    },
  },
});
