import { createAuthClient } from "better-auth/react";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";

/**
 * Клиент Better Auth. Ходит на тот же origin, что и фронт: в dev его
 * разворачивает прокси Vite, в проде Nest раздаёт и то и другое. Поэтому
 * httpOnly-cookie сессии ходит сама, без CORS и без хранения токена в JS.
 *
 * `adminClient` нужен не ради админских вызовов (список пользователей идёт
 * через наш /api/admin/users), а ради типа: роль в сессию добавляет
 * admin-плагин, и без него `user.role` на клиенте не существует.
 *
 * `inferAdditionalFields` повторяет additionalFields из apps/api/src/auth:
 * `phone` — своё поле, базовая модель Better Auth о нём не знает.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [
    adminClient(),
    inferAdditionalFields({
      user: {
        phone: { type: "string" },
      },
    }),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  updateUser,
  changePassword,
  verifyEmail,
  sendVerificationEmail,
  requestPasswordReset,
  resetPassword,
} = authClient;
