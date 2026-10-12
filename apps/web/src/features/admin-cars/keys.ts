import type { QueryClient } from "@tanstack/react-query";
import type { AdminCar } from "@carshowroom/contracts";

/**
 * Ключи админки автомобилей. Список, справочники и карточка — соседние ветки
 * одного корня, а не вложенные друг в друга: правка карточки сбрасывает
 * список, но не перезапрашивает карточку, ответ которой уже лежит в кеше.
 */
export const adminCarsKeys = {
  all: ["admin", "cars"] as const,
  lists: () => [...adminCarsKeys.all, "list"] as const,
  list: (query: Record<string, string | number | undefined>) =>
    [...adminCarsKeys.lists(), query] as const,
  options: () => [...adminCarsKeys.all, "options"] as const,
  detail: (id: number) => [...adminCarsKeys.all, "detail", id] as const,
};

/**
 * Что устаревает от любой правки автомобиля: строка админского списка и
 * публичная витрина. `["car"]` сбрасывается целиком, а не по slug — slug
 * мог смениться, и старый адрес тоже должен перестать показывать машину.
 * `["catalog-filters"]` не трогаем: это справочники серий, кузовов и
 * топлива, от набора машин они не зависят.
 */
function invalidateCarLists(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: adminCarsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: ["cars"] });
  void queryClient.invalidateQueries({ queryKey: ["car"] });
}

/** Мутация вернула полную карточку: кладём её в кеш как есть, остальное — сбросить. */
export function syncAdminCar(queryClient: QueryClient, car: AdminCar) {
  queryClient.setQueryData(adminCarsKeys.detail(car.id), car);
  invalidateCarLists(queryClient);
}

/** Автомобиль удалён: карточки больше нет, запрашивать её заново незачем. */
export function forgetAdminCar(queryClient: QueryClient, id: number) {
  queryClient.removeQueries({ queryKey: adminCarsKeys.detail(id) });
  invalidateCarLists(queryClient);
}
