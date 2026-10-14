import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": root,
      "server-only": path.join(root, "tests/stubs/server-only.ts"),
    },
  },
});
