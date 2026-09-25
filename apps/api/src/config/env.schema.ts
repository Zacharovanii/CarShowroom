import { z } from "zod";

/** `WEB_ORIGIN` — один URL или несколько через запятую. */
export function splitOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// Единственное место, где перечислены переменные окружения приложения
// (кроме auth/auth.ts — он собирается раньше, до NestFactory.create,
// см. src/env.ts). Список и есть источник правды для .env.example.
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url("должен быть валидным postgres:// URL"),
  BETTER_AUTH_SECRET: z.string().min(1, "не должен быть пустым"),
  BETTER_AUTH_URL: z.url(),
  /**
   * Origin фронта в dev. Vite отдаёт SPA со своего порта и проксирует /api,
   * поэтому браузер шлёт Origin этого порта, а не BETTER_AUTH_URL. Better Auth
   * сверяет Origin со списком доверенных и иначе отвечает 403 INVALID_ORIGIN.
   * В проде Nest раздаёт фронт и API с одного origin — переменная не нужна.
   * Можно несколько через запятую: localhost и 127.0.0.1 — разные origin.
   */
  WEB_ORIGIN: z
    .string()
    .refine(
      (value) => splitOrigins(value).every((origin) => z.url().safeParse(origin).success),
      "список URL через запятую",
    )
    .optional(),
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
