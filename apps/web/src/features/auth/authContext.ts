import { createContext, use } from "react";
import { userRoles, type UserRole } from "@carshowroom/contracts";

/** Пользователь в том виде, в каком его читает интерфейс. */
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: string;
};

export type AuthValue = {
  user: CurrentUser | null;
  /**
   * Сессия ещё проверяется. Важно отличать от «не вошёл»: иначе на F5
   * защищённый маршрут успевает мигнуть редиректом на /login.
   */
  isPending: boolean;
  isAuthenticated: boolean;
  /** Менеджер и админ. Права накопительные: админ может всё, что менеджер. */
  isStaff: boolean;
  isAdmin: boolean;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = use(AuthContext);
  if (!value) {
    throw new Error("useAuth вызван вне AuthProvider");
  }
  return value;
}

/**
 * Роль в ответах Better Auth — обычная строка: её добавляет admin-плагин,
 * и список значений он не знает. Незнакомое значение трактуем как клиента:
 * права всё равно проверяет бэкенд, фронт лишь прячет недоступное.
 */
export function toUserRole(value: unknown): UserRole {
  return typeof value === "string" && (userRoles as readonly string[]).includes(value)
    ? (value as UserRole)
    : "user";
}

/** Куда отправить человека после входа, если он пришёл не по ссылке. */
export function homeRouteForRole(role: UserRole): string {
  if (role === "admin") return "/admin/users";
  if (role === "manager") return "/manager";
  return "/account";
}
