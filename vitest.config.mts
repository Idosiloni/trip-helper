import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Loads .env.local for tests/rls (all vars, not only VITE_*).
    env: loadEnv("test", process.cwd(), ""),
    environment: "node",
  },
});
