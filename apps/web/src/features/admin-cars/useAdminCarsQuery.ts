import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { adminCarsQuerySchema, type AdminCarsQuery } from "@carshowroom/contracts";

/**
 * Состояние списка автомобилей в админке живёт в URL — тем же приёмом, что
 * и список пользователей (`features/admin/useUsersQuery`): ссылкой можно
 * поделиться, «назад» с карточки возвращает прежний отбор. Разбор — схемой
 * контракта, поэтому умолчания `status: "all"` и `page: 1` задаёт она.
 */

/** Что считается «заданным отбором»: страница отбором не является. */
const FILTER_KEYS = ["q", "status"] as const satisfies readonly (keyof AdminCarsQuery)[];

/** Умолчания берём у схемы: второго списка значений в проекте быть не должно. */
const DEFAULTS: Record<string, unknown> = adminCarsQuerySchema.parse({});

/**
 * Адрес может прийти откуда угодно. Негодные параметры не должны ронять
 * страницу и не должны уезжать в API (он ответит 400) — они выбрасываются.
 */
function parseQuery(params: URLSearchParams): AdminCarsQuery {
  const raw: Record<string, string> = Object.fromEntries(params);

  const parsed = adminCarsQuerySchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") delete raw[key];
  }

  const retry = adminCarsQuerySchema.safeParse(raw);
  return retry.success ? retry.data : adminCarsQuerySchema.parse({});
}

/** Обратная запись: значения по умолчанию в URL не пишутся, иначе адрес зарастает. */
function serializeQuery(query: AdminCarsQuery): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    if (value === DEFAULTS[key]) continue;
    params.set(key, String(value));
  }

  return params;
}

export interface AdminCarsQueryState {
  query: AdminCarsQuery;
  /** Меняет часть запроса; `undefined` в значении убирает параметр из URL. */
  setQuery: (patch: Partial<AdminCarsQuery>) => void;
  /** Снимает поиск и фильтр по статусу. */
  resetFilters: () => void;
  /** Задан ли хоть какой-то отбор — от этого зависит пустое состояние. */
  hasFilters: boolean;
}

export function useAdminCarsQuery(): AdminCarsQueryState {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useMemo(() => parseQuery(searchParams), [searchParams]);

  const setQuery = useCallback(
    (patch: Partial<AdminCarsQuery>) => {
      setSearchParams((previous) => {
        const next: AdminCarsQuery = { ...parseQuery(previous), ...patch };
        // Смена поиска или статуса возвращает на первую страницу: выборка
        // сузилась, а прежней страницы в ней может уже не быть.
        if (patch.page === undefined) next.page = 1;
        return serializeQuery(next);
      });
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(serializeQuery(adminCarsQuerySchema.parse({})));
  }, [setSearchParams]);

  // У статуса есть умолчание «all», поэтому «задан» — это не undefined, а отличие от него
  const hasFilters = FILTER_KEYS.some((key) => query[key] !== DEFAULTS[key]);

  return { query, setQuery, resetFilters, hasFilters };
}
