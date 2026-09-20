import { z } from "zod";

// Единственное место, где перечислены переменные окружения приложения
// (кроме auth/auth.ts — он собирается раньше, до NestFactory.create,
// см. src/env.ts). Список и есть источник правды для .env.example.
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url("должен быть валидным postgres:// URL"),
  BETTER_AUTH_SECRET: z.string().min(1, "не должен быть пустым"),
  BETTER_AUTH_URL: z.url(),
});

export type AppConfig = z.infer<typeof envSchema>;

/**
 * Падает при старте, если конфига не хватает или он не проходит проверку —
 * лучше здесь, с понятным списком проблем, чем позже в случайном месте кода
 * с TypeError на undefined.
 */
export function parseConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(корень)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Некорректная конфигурация окружения — проверьте .env (см. .env.example):\n${issues}`,
    );
  }
  return result.data;
}
