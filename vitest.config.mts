import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // "server-only" throws outside Next's server; tests run plain Node.
      "server-only": path.join(root, "tests/stubs/empty.ts"),
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
