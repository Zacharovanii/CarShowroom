import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  userSchema,
  usersResponseSchema,
  type CreateManager,
  type UsersQuery,
} from "@carshowroom/contracts";
import { apiFetch } from "@/shared/api";

/** Общий корень ключей: создание менеджера сбрасывает весь список целиком. */
const USERS_KEY = ["admin", "users"] as const;

/**
 * `GET /api/admin/users` (UC-A1). Ответ разбирается схемой контракта: если
 * фронт и API разойдутся, это станет видно здесь, а не в вёрстке.
 */
export function useUsers(params: UsersQuery) {
  const query: Record<string, string | number | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query[key] = value;
  }

  return useQuery({
    queryKey: [...USERS_KEY, query],
    queryFn: ({ signal }) =>
      apiFetch("/admin/users", { query, schema: usersResponseSchema, signal }),
  });
}

/**
 * `POST /api/admin/users` (UC-A2). Роль в теле не передаётся — через
 * интерфейс заводится только менеджер, её ставит сервер.
 */
export function useCreateManager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateManager) =>
      apiFetch("/admin/users", { method: "POST", body, schema: userSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}
