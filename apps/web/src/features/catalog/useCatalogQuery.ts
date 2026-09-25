import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { carsQuerySchema, type CarsQuery } from "@carshowroom/contracts";

/**
 * Состояние каталога целиком живёт в URL (UC-G2): ссылкой можно поделиться,
 * «назад» возвращает прежний выбор. Разбор — схемой контракта, поэтому
 * значения по умолчанию (`sort: "newest"`, `page: 1`) задаёт она,
 * а не фронт.
 */

/** Что считается «заданным фильтром»: сортировка и страница фильтрами не являются. */
const FILTER_KEYS = [
  "q",
  "series",
  "body",
  "fuel",
  "drive",
  "priceMin",
  "priceMax",
] as const satisfies readonly (keyof CarsQuery)[];

/** Умолчания берём у схемы: второго списка значений в проекте быть не должно. */
const DEFAULTS: Record<string, unknown> = carsQuerySchema.parse({});

/**
 * Адрес может прийти откуда угодно — из чужой ссылки, из истории, из правки
 * руками. Негодные параметры не должны ронять страницу и не должны уезжать
 * в API (он ответит 400), поэтому они просто выбрасываются.
 */
function parseQuery(params: URLSearchParams): CarsQuery {
  const raw: Record<string, string> = Object.fromEntries(params);

  const parsed = carsQuerySchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") delete raw[key];
  }

  const retry = carsQuerySchema.safeParse(raw);
  return retry.success ? retry.data : carsQuerySchema.parse({});
}

/** Обратная запись: значения по умолчанию в URL не пишутся, иначе адрес зарастает. */
function serializeQuery(query: CarsQuery): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    if (value === DEFAULTS[key]) continue;
    params.set(key, String(value));
  }

  return params;
}

export interface CatalogQueryState {
  query: CarsQuery;
  /** Меняет часть запроса; `undefined` в значении убирает параметр из URL. */
  setQuery: (patch: Partial<CarsQuery>) => void;
  /** Снимает все фильтры и поиск, сортировку оставляет. */
  resetFilters: () => void;
  /** Сколько фильтров задано — число в кнопке «Фильтры» на телефоне. */
  activeFilterCount: number;
}

export function useCatalogQuery(): CatalogQueryState {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useMemo(() => parseQuery(searchParams), [searchParams]);

  const setQuery = useCallback(
    (patch: Partial<CarsQuery>) => {
      setSearchParams(
        (previous) => {
          const next: CarsQuery = { ...parseQuery(previous), ...patch };
          // Любая смена фильтра или сортировки возвращает на первую страницу:
          // иначе выбор сужается, а пользователь остаётся на странице, которой уже нет.
          if (patch.page === undefined) next.page = 1;
          return serializeQuery(next);
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams((previous) =>
      serializeQuery(carsQuerySchema.parse({ sort: parseQuery(previous).sort })),
    );
  }, [setSearchParams]);

  const activeFilterCount = FILTER_KEYS.filter((key) => query[key] !== undefined).length;

  return { query, setQuery, resetFilters, activeFilterCount };
}
