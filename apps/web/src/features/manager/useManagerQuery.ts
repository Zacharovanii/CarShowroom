import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { managerTestDrivesQuerySchema, type ManagerTestDrivesQuery } from "@carshowroom/contracts";
import { toSalonDay } from "@/shared/format";

/**
 * День и фильтры живут в адресе: ссылкой на день можно поделиться со сменщиком,
 * а «назад» возвращает предыдущий день, а не уводит с экрана.
 *
 * Разбор — схемой контракта: в запрос уходит ровно то, что она допускает,
 * а мусор в адресе (`?date=вчера`, `?status=готово`) не роняет экран —
 * он сбрасывается к сегодняшнему дню без фильтров.
 */
export function useManagerQuery() {
  const [params, setParams] = useSearchParams();

  const query = useMemo<ManagerTestDrivesQuery>(() => {
    const parsed = managerTestDrivesQuerySchema.safeParse({
      date: params.get("date") ?? toSalonDay(),
      carId: params.get("carId") ?? undefined,
      status: params.get("status") ?? undefined,
    });

    return parsed.success ? parsed.data : { date: toSalonDay() };
  }, [params]);

  const setQuery = useCallback(
    (patch: Partial<ManagerTestDrivesQuery>) => {
      const next = { ...query, ...patch };
      const search = new URLSearchParams();

      // Дата пишется всегда, даже сегодняшняя: адрес экрана должен
      // однозначно называть день, который на нём открыт.
      search.set("date", next.date);
      if (next.carId !== undefined) search.set("carId", String(next.carId));
      if (next.status !== undefined) search.set("status", next.status);

      setParams(search);
    },
    [query, setParams],
  );

  const hasFilters = query.carId !== undefined || query.status !== undefined;

  return { query, setQuery, hasFilters };
}
