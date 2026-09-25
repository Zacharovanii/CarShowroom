import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { usersQuerySchema, type UsersQuery } from "@carshowroom/contracts";

/**
 * Состояние списка пользователей живёт в URL — тем же приёмом, что и каталог
 * (`features/catalog/useCatalogQuery`): ссылкой можно поделиться, «назад»
 * возвращает прежний отбор. Разбор — схемой контракта, поэтому умолчание
 * `page: 1` задаёт она, а не фронт.
 */

/** Что считается «заданным отбором»: страница отбором не является. */
const FILTER_KEYS = ["q", "role"] as const satisfies readonly (keyof UsersQuery)[];

/** Умолчания берём у схемы: второго списка значений в проекте быть не должно. */
const DEFAULTS: Record<string, unknown> = usersQuerySchema.parse({});

/**
 * Адрес может прийти откуда угодно — из чужой ссылки, из истории, из правки
 * руками. Негодные параметры не должны ронять страницу и не должны уезжать
 * в API (он ответит 400), поэтому они просто выбрасываются.
 */
function parseQuery(params: URLSearchParams): UsersQuery {
  const raw: Record<string, string> = Object.fromEntries(params);

  const parsed = usersQuerySchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") delete raw[key];
  }

  const retry = usersQuerySchema.safeParse(raw);
  return retry.success ? retry.data : usersQuerySchema.parse({});
}

/** Обратная запись: значения по умолчанию в URL не пишутся, иначе адрес зарастает. */
function serializeQuery(query: UsersQuery): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    if (value === DEFAULTS[key]) continue;
    params.set(key, String(value));
  }

  return params;
}

export interface UsersQueryState {
  query: UsersQuery;
  /** Меняет часть запроса; `undefined` в значении убирает параметр из URL. */
  setQuery: (patch: Partial<UsersQuery>) => void;
  /** Снимает поиск и фильтр по роли. */
  resetFilters: () => void;
  /** Задан ли хоть какой-то отбор — от этого зависит пустое состояние. */
  hasFilters: boolean;
}

export function useUsersQuery(): UsersQueryState {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useMemo(() => parseQuery(searchParams), [searchParams]);

  const setQuery = useCallback(
    (patch: Partial<UsersQuery>) => {
      setSearchParams((previous) => {
        const next: UsersQuery = { ...parseQuery(previous), ...patch };
        // Смена поиска или роли возвращает на первую страницу: иначе выборка
        // сузилась, а человек остался на странице, которой уже нет.
        if (patch.page === undefined) next.page = 1;
        return serializeQuery(next);
      });
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(serializeQuery(usersQuerySchema.parse({})));
  }, [setSearchParams]);

  const hasFilters = FILTER_KEYS.some((key) => query[key] !== undefined);

  return { query, setQuery, resetFilters, hasFilters };
}
