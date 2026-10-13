import { z } from "zod";

/** `WEB_ORIGIN` — один URL или несколько через запятую. */
export function splitOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// Единственное место, где перечислены переменные окружения приложения.
// auth/auth.ts и mail/mail.ts читают process.env напрямую — Better Auth
// собирается раньше, до NestFactory.create (см. src/env.ts), — но проверяются
// их переменные всё равно здесь, при старте Nest. Список и есть источник
// правды для .env.example.
export const envSchema = z
  .object({
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
    /**
     * S3-хранилище файлов, загруженных админом (D26). В dev — MinIO из
     * docker/compose.yml, значения совпадают с сервисами minio и minio-init.
     */
    S3_ENDPOINT: z.url(),
    /**
     * MinIO регион не проверяет, но AWS SDK без него не создаёт клиента
     * и подписывает запросы с регионом — us-east-1 MinIO принимает всегда.
     */
    S3_REGION: z.string().min(1, "не должен быть пустым"),
    S3_BUCKET: z.string().min(1, "не должен быть пустым"),
    S3_ACCESS_KEY: z.string().min(1, "не должен быть пустым"),
    S3_SECRET_KEY: z.string().min(1, "не должен быть пустым"),
    /**
     * Ключ Resend (D27). Без него письма не уходят: ссылка из письма пишется
     * в лог API, а само письмо — в outbox для тестов (mail/mail.ts).
     */
    RESEND_API_KEY: z.string().min(1, "не должен быть пустым").optional(),
    /**
     * Отправитель: "CarShowroom <noreply@домен>". Домен должен быть
     * подтверждён в Resend; тестовый onboarding@resend.dev доставляет только
     * на адрес владельца аккаунта Resend.
     */
    MAIL_FROM: z.string().min(1, "не должен быть пустым").optional(),
  })
  // В проде без почты не подтвердить email — а без подтверждения не войти
  // никому, поэтому падаем при старте, а не на первой регистрации.
  .superRefine((env, ctx) => {
    const production = env.NODE_ENV === "production";
    if (production && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "обязателен в production: без него письма подтверждения не уходят",
      });
    }
    // ключ без отправителя — Resend ответит 422 на каждое письмо
    if ((production || env.RESEND_API_KEY) && !env.MAIL_FROM) {
      ctx.addIssue({
        code: "custom",
        path: ["MAIL_FROM"],
        message: 'обязателен в production и вместе с RESEND_API_KEY: "CarShowroom <noreply@домен>"',
      });
    }
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
