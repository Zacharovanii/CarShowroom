import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { signUpSchema, updateProfileSchema } from "@carshowroom/contracts";
import type { BetterAuthOptions } from "better-auth";
import type { ZodType } from "zod";
import { splitOrigins } from "../config/env.schema.js";
import { sendMail } from "../mail/mail.js";
import { resetPasswordMail, verifyEmailMail } from "../mail/templates.js";

// Отдельный пул для Better Auth (D7.1): postgres.js — для остального кода,
// сюда наружу из модуля auth не выходит. max=5, явно — чтобы число было
// решением, а не значением по умолчанию.
export const authPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

// D16: manager — подмножество прав admin-плагина (список и просмотр
// пользователей), admin — полный набор defaultStatements. Сами права
// (test_drives и т.д.) не отсюда — у @Roles() в наших контроллерах.
const ac = createAccessControl(defaultStatements);

/**
 * Маршруты Better Auth — не наши контроллеры: они поднимаются как raw
 * middleware в обход роутера Nest, поэтому ZodValidationPipe на них не
 * навесить. Валидация схемами контракта делается единственным доступным
 * способом — before-хуком самого Better Auth.
 *
 * Проверяются поля, у которых в БД есть CHECK (`phone`, `name`, `email`):
 * без этого некорректный телефон доходил бы до Postgres и возвращался
 * ошибкой драйвера. Вход и смена пароля не проверяются: формат пароля там
 * сверять нечего (UC-G6 требует общего сообщения), а длину нового пароля
 * Better Auth проверяет сам тем же правилом «не короче 8».
 */
const bodyRules: Record<string, ZodType> = {
  "/sign-up/email": signUpSchema.loose(),
  // update-user частичный: форма UC-U2 шлёт только изменённые поля
  "/update-user": updateProfileSchema.partial().loose(),
};

// Тип возвращается явным: инференс createAuthMiddleware тянет за собой
// внутренние типы @better-auth/core, которые tsc не может назвать (TS2883).
type BeforeHook = NonNullable<NonNullable<BetterAuthOptions["hooks"]>["before"]>;

const validateBody: BeforeHook = createAuthMiddleware(async (ctx) => {
  const schema = bodyRules[ctx.path];
  if (!schema) return;

  const result = schema.safeParse(ctx.body ?? {});
  if (!result.success) {
    throw new APIError("BAD_REQUEST", {
      code: "VALIDATION_FAILED",
      message: "Некорректные данные запроса",
      issues: result.error.issues,
    });
  }

  // дальше идёт нормализованное тело: email в нижнем регистре (того же
  // требует CHECK users_email_ck), имя без крайних пробелов
  return { context: { ...ctx, body: result.data as Record<string, unknown> } };
});

// В dev фронт живёт на своём порту (Vite) и проксирует /api сюда, поэтому
// браузер присылает Origin этого порта. По умолчанию Better Auth доверяет
// только baseURL и отвечает 403 INVALID_ORIGIN — вход в браузере не работает
// вовсе, хотя curl с подставленным Origin проходит. В проде фронт и API
// на одном origin, WEB_ORIGIN не задаётся и список сводится к baseURL.
const trustedOrigins = [
  process.env.BETTER_AUTH_URL,
  ...splitOrigins(process.env.WEB_ORIGIN),
].filter((origin): origin is string => Boolean(origin));

/**
 * Ссылки в письмах ведут на страницы фронта, а не на маршруты Better Auth
 * (D27): url, который библиотека передаёт в колбэк, строится от
 * BETTER_AUTH_URL — в dev это :3000, и cookie сессии после автовхода встала бы
 * на хост API, а не фронта. Фронт сам вызывает /api/auth/... через свой прокси,
 * и cookie ставится на его origin.
 *
 * Origin берётся из запроса, который вызвал отправку письма (регистрация,
 * вход, «выслать заново», «забыл пароль»): с какого адреса человек пришёл,
 * туда и вернётся — localhost и 127.0.0.1 в dev разные хосты. Origin
 * подставляет клиент, поэтому принимается только из trustedOrigins; иначе
 * (и при вызове auth.api.* с сервера, без запроса) — BETTER_AUTH_URL.
 */
function frontendLink(path: string, token: string, request?: Request): string {
  const origin = request?.headers.get("origin");
  const base = origin && trustedOrigins.includes(origin) ? origin : process.env.BETTER_AUTH_URL;
  const link = new URL(path, base);
  link.searchParams.set("token", token);
  return link.href;
}

const managerRole = ac.newRole({
  user: ["list", "get"],
  session: ["list"],
});

export const auth = betterAuth({
  database: authPool,
  basePath: "/api/auth",

  trustedOrigins,

  // generateId: "uuid" → Postgres gen_random_uuid(), как у прикладных таблиц (D19).
  advanced: {
    database: {
      generateId: "uuid",
    },
  },

  // Без подтверждённого email вход отвечает 403 EMAIL_NOT_VERIFIED, а
  // регистрация больше не создаёт сессию — только отправляет письмо (D27).
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 3600,
    // сброс пароля — обычно реакция на «меня взломали»: старые сессии,
    // включая чужую, должны перестать работать
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }, request) => {
      await sendMail(resetPasswordMail(user, frontendLink("/reset-password", token, request)));
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // вход неподтверждённым высылает свежее письмо: первое могло истечь или
    // потеряться, а других путей у человека, забывшего про письмо, нет
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
    sendVerificationEmail: async ({ user, token }, request) => {
      await sendMail(verifyEmailMail(user, frontendLink("/verify-email", token, request)));
    },
  },

  /**
   * Ограничение частоты. По умолчанию Better Auth включает его только при
   * NODE_ENV=production — у нас включено и в dev, чтобы лимиты проверялись
   * руками до выкатки. Выключено в тестах (vitest выставляет NODE_ENV=test
   * до импорта модулей): e2e шлют десятки входов и регистраций с одного
   * адреса, а поведение самой библиотеки тестировать незачем.
   *
   * Клиента Better Auth узнаёт только по заголовку X-Forwarded-For, адрес
   * сокета он не видит. Принимается заголовок с одним адресом (цепочку
   * «a, b» без advanced.ipAddress.trustedProxies он отбрасывает как
   * подделываемую). Нет адреса — в development и test подставляется 127.0.0.1,
   * иначе все запросы делят один общий бакет на путь (и в лог пишется
   * предупреждение). Так бывает в dev: nest start не задаёт NODE_ENV, а прокси
   * Vite X-Forwarded-For не ставит — на одной машине это и так один человек.
   * В проде перед API обязан стоять прокси, который перезаписывает заголовок
   * адресом клиента (Caddy делает это по умолчанию, D28),
   * иначе лимит входа станет общим на всех посетителей.
   */
  rateLimit: {
    enabled: process.env.NODE_ENV !== "test",
    storage: "memory",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      // каждый запрос — письмо: без строгого лимита форма превращается
      // в спам-рассылку на чужие адреса
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
    },
  },

  hooks: {
    before: validateBody,
  },

  // Email подтверждается письмом (D27, выше); OAuth выключен (D7) —
  // соцпровайдеров нет.
  user: {
    modelName: "users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    // users.phone — not null в схеме, поэтому обязательное поле формы регистрации.
    additionalFields: {
      phone: {
        type: "string",
        required: true,
        input: true,
      },
    },
  },

  session: {
    modelName: "sessions",
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },

  account: {
    modelName: "accounts",
    fields: {
      userId: "user_id",
      providerId: "provider_id",
      accountId: "account_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },

  verification: {
    modelName: "verifications",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },

  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      ac,
      roles: {
        admin: adminAc,
        manager: managerRole,
      },
      // admin-плагин добавляет свои колонки поверх user/session — те же
      // fields, что и у базовой модели, только он их не видит: своё
      // отображение имён в snake_case задаётся тут, отдельно.
      schema: {
        user: {
          fields: {
            banReason: "ban_reason",
            banExpires: "ban_expires",
          },
        },
        session: {
          fields: {
            impersonatedBy: "impersonated_by",
          },
        },
      },
    }),
  ],
});
