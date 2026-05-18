import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@forma-lang/forma": fileURLToPath(new URL("../packages/forma-typescript/src/index.ts", import.meta.url)),
    },
  },
});
