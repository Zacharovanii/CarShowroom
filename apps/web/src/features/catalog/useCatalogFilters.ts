import { useQuery } from "@tanstack/react-query";
import { catalogFiltersSchema } from "@carshowroom/contracts";
import { apiFetch } from "@/shared/api";

/**
 * `GET /api/catalog/filters` — справочники серий, кузовов и типов двигателя.
 * В URL фильтра уходит `id` строки справочника, а не имя (D19), поэтому
 * подписи нужны только для выпадающих списков.
 *
 * Справочники за сессию не меняются, поэтому запрос не протухает: панель
 * фильтров не должна ходить в сеть на каждое возвращение в каталог.
 */
export function useCatalogFilters() {
  return useQuery({
    queryKey: ["catalog-filters"],
    queryFn: ({ signal }) => apiFetch("/catalog/filters", { schema: catalogFiltersSchema, signal }),
    staleTime: Infinity,
  });
}
