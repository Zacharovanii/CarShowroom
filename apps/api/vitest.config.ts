import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["**/*.spec.ts"],
    // .env не подхватывается автоматически вне main.ts (nest start --watch
    // его тоже не читает) — тестам он нужен для DATABASE_URL модуля auth.
    setupFiles: ["./src/env.ts"],
  },
});
