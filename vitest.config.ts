import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Engine tests run in a plain Node environment (no DOM): the financial engine is
// pure TypeScript with no React. The `@/` alias mirrors tsconfig `paths`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["engine/**/*.test.ts", "test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
