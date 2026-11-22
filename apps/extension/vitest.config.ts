import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __INTRUVA_DEV__: "true" },
  test: {
    environment: "happy-dom",
    include: ["test/unit/**/*.test.ts"],
  },
});
