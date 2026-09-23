import { z } from "zod";
import {
  emailSchema,
  instantSchema,
  passwordSchema,
  personNameSchema,
  phoneSchema,
} from "./common.js";

/** Роли (use-cases.md, «Роли»); те же значения, что в CHECK users_role_ck. */
export const userRoles = ["user", "manager", "admin"] as const;

export type UserRole = (typeof userRoles)[number];

/** Размер страницы списка пользователей — константа, как и в каталоге. */
export const USERS_PAGE_SIZE = 20;

// ---------------------------------------------------------------------
// GET /api/admin/users?q=&role=&page=
// ---------------------------------------------------------------------

export const usersQuerySchema = z.object({
  /** Поиск по имени и email (UC-A1). */
  q: z.string().trim().min(1).optional(),
  role: z.enum(userRoles).optional(),
  page: z.coerce.number().int().positive().default(1),
});

export type UsersQuery = z.infer<typeof usersQuerySchema>;

export const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  phone: phoneSchema,
  role: z.enum(userRoles),
  createdAt: instantSchema,
});

export const usersResponseSchema = z.object({
  items: z.array(userSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type User = z.infer<typeof userSchema>;
export type UsersResponse = z.infer<typeof usersResponseSchema>;

// ---------------------------------------------------------------------
// POST /api/admin/users
// ---------------------------------------------------------------------

/**
 * Создание сотрудника. Роль в теле не передаётся: через API заводится
 * только менеджер, роль `admin` назначается seed-скриптом (UC-A2).
 * Пароль временный — админ передаёт его сотруднику сам, писем не шлём.
 */
export const createManagerSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export type CreateManager = z.infer<typeof createManagerSchema>;
