import { RotateCcw } from "lucide-react";
import { CARS_PAGE_SIZE, carSorts, type CarSort } from "@carshowroom/contracts";
import { Button, Pagination, Select, StatePanel, type SelectOption } from "@/components/ui";
import {
  CarCard,
  CarCardSkeleton,
  CatalogSearch,
  FilterDisclosure,
  FilterPanel,
  useCars,
  useCatalogFilters,
  useCatalogQuery,
} from "@/features/catalog";
import styles from "./CatalogPage.module.css";

const SORT_LABELS: Record<CarSort, string> = {
  newest: "Сначала новые",
  "price-asc": "Сначала дешёвые",
  "price-desc": "Сначала дорогие",
};

const SORT_OPTIONS: SelectOption[] = carSorts.map((sort) => ({
  value: sort,
  label: SORT_LABELS[sort],
}));

/** «1 автомобиль», «2 автомобиля», «10 автомобилей». */
function carsWord(count: number): string {
  const tens = count % 100;
  const ones = count % 10;
  if (ones === 1 && tens !== 11) return "автомобиль";
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return "автомобиля";
  return "автомобилей";
}

/**
 * Каталог — UC-G2.
 *
 * Все фильтры, поиск, сортировка и страница живут в URL (`useCatalogQuery`),
 * поэтому страница сама состояния почти не держит: она читает запрос,
 * показывает результат и отдаёт изменения обратно в адрес.
 */
export default function CatalogPage() {
  const { query, setQuery, resetFilters, activeFilterCount } = useCatalogQuery();
  const filters = useCatalogFilters();
  const cars = useCars(query);

  const total = cars.data?.total;

  function changePage(page: number) {
    setQuery({ page });
    // Страница листается кнопкой внизу списка: без этого следующая порция
    // открывается на своём хвосте.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Каталог</h1>
        <p className={styles.count}>
          {total === undefined ? "Подбираем автомобили…" : `${total} ${carsWord(total)}`}
        </p>
      </header>

      {/* Одна строка на любой ширине: поиск, кнопка фильтров с раскрывающейся
          панелью (как у Select) и сортировка. Раньше здесь была либо статичная
          боковая колонка, либо отдельная модалка на телефоне — два вида
          вместо одного без нужды. */}
      <div className={styles.toolbar}>
        <CatalogSearch
          value={query.q}
          onChange={(q) => setQuery({ q })}
          withLabel={false}
          className={styles.search}
        />

        <FilterDisclosure activeFilterCount={activeFilterCount}>
          <FilterPanel
            query={query}
            filters={filters.data}
            onChange={setQuery}
            onReset={resetFilters}
            activeFilterCount={activeFilterCount}
            showSearch={false}
          />
        </FilterDisclosure>

        <Select
          options={SORT_OPTIONS}
          value={query.sort}
          aria-label="Сортировка"
          onValueChange={(value) => setQuery({ sort: value as CarSort })}
          className={styles.sort}
        />
      </div>

      <section className={styles.results}>
        {cars.isError ? (
          <StatePanel
            variant="error"
            title="Не удалось загрузить каталог"
            description="Проверьте соединение и попробуйте снова."
            action={
              <Button variant="primary" loading={cars.isFetching} onClick={() => cars.refetch()}>
                Повторить
              </Button>
            }
          />
        ) : cars.isPending ? (
          <div className={styles.grid} aria-busy="true">
            {Array.from({ length: CARS_PAGE_SIZE }, (_, index) => (
              <CarCardSkeleton key={index} />
            ))}
          </div>
        ) : cars.data.items.length === 0 ? (
          <StatePanel
            title="Ничего не нашлось"
            description="Попробуйте изменить фильтры или сбросить их."
            action={
              // Пусто бывает и без фильтров: по чужой ссылке со страницей,
              // которой в текущей выборке уже нет. Сброс возвращает и её.
              activeFilterCount > 0 || query.page > 1 ? (
                <Button
                  variant="primary"
                  iconStart={<RotateCcw aria-hidden="true" />}
                  onClick={resetFilters}
                >
                  Сбросить фильтры
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className={styles.grid}>
              {cars.data.items.map((car, index) => (
                <CarCard key={car.id} car={car} priority={index < 3} />
              ))}
            </div>

            <Pagination
              page={cars.data.page}
              totalPages={cars.data.totalPages}
              onPageChange={changePage}
              className={styles.pagination}
            />
          </>
        )}
      </section>
    </div>
  );
}
