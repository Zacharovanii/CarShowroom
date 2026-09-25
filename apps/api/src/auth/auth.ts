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

const managerRole = ac.newRole({
  user: ["list", "get"],
  session: ["list"],
});

export const auth = betterAuth({
  database: authPool,
  basePath: "/api/auth",

  // В dev фронт живёт на своём порту (Vite) и проксирует /api сюда, поэтому
  // браузер присылает Origin этого порта. По умолчанию Better Auth доверяет
  // только baseURL и отвечает 403 INVALID_ORIGIN — вход в браузере не работает
  // вовсе, хотя curl с подставленным Origin проходит. В проде фронт и API
  // на одном origin, WEB_ORIGIN не задаётся и список сводится к baseURL.
  trustedOrigins: [process.env.BETTER_AUTH_URL, ...splitOrigins(process.env.WEB_ORIGIN)].filter(
    (origin): origin is string => Boolean(origin),
  ),

  // generateId: "uuid" → Postgres gen_random_uuid(), как у прикладных таблиц (D19).
  advanced: {
    database: {
      generateId: "uuid",
    },
  },

  emailAndPassword: {
    enabled: true,
  },

  hooks: {
    before: validateBody,
  },

  // Email-подтверждение и OAuth выключены (D7) — соцпровайдеров нет,
  // sendVerificationEmail не настроен.
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
