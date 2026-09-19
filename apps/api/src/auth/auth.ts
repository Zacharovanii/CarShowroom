import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

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

const managerRole = ac.newRole({
  user: ["list", "get"],
  session: ["list"],
});

export const auth = betterAuth({
  database: authPool,
  basePath: "/api/auth",

  // generateId: "uuid" → Postgres gen_random_uuid(), как у прикладных таблиц (D19).
  advanced: {
    database: {
      generateId: "uuid",
    },
  },

  emailAndPassword: {
    enabled: true,
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
