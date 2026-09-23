import { Injectable } from "@nestjs/common";
import {
  USERS_PAGE_SIZE,
  type CreateManager,
  type User,
  type UsersQuery,
  type UsersResponse,
} from "@carshowroom/contracts";
import { auth } from "../auth/auth.js";
import { AppError } from "../common/app-error.js";
import { AdminRepository, type UserRow } from "./admin.repository.js";

// Ошибка Better Auth про занятый email. Класс APIError не импортируем:
// хватает формы ответа, а поле code задокументировано (ADMIN_ERROR_CODES).
function isEmailTaken(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { body?: { code?: unknown } }).body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
  );
}

/**
 * Пользователи (UC-A1, UC-A2). Роль здесь не проверяется — это дело
 * guard-а на контроллере.
 */
@Injectable()
export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

  /** UC-A1: список пользователей — поиск, фильтр по роли, пагинация. */
  async getUsers(query: UsersQuery): Promise<UsersResponse> {
    const [rows, total] = await Promise.all([
      this.repository.findUsers(query),
      this.repository.countUsers(query),
    ]);

    return {
      items: rows.map(toUser),
      page: query.page,
      pageSize: USERS_PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / USERS_PAGE_SIZE),
    };
  }

  /**
   * UC-A2: создание менеджера. Пользователь заводится admin-плагином
   * Better Auth, а не insert-ом в users: вместе с пользователем нужна
   * строка в accounts с хешем пароля, иначе сотрудник не сможет войти.
   *
   * Вызов идёт без headers — тогда плагин не ищет сессию и не проверяет
   * свои права: сюда уже пустил @Roles(["admin"]) на контроллере.
   * Роль задана константой: через API заводится только менеджер (UC-A2).
   */
  async createManager(input: CreateManager): Promise<User> {
    try {
      const { user } = await auth.api.createUser({
        body: {
          email: input.email,
          password: input.password,
          name: input.name,
          role: "manager",
          data: { phone: input.phone },
        },
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: input.phone,
        role: "manager",
        createdAt: new Date(user.createdAt).toISOString(),
      };
    } catch (error) {
      if (isEmailTaken(error)) {
        throw new AppError("EMAIL_TAKEN", "Этот email уже занят", { email: input.email });
      }
      throw error;
    }
  }
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}
