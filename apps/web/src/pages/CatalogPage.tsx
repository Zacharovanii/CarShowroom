import { useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { CARS_PAGE_SIZE, carSorts, type CarSort } from "@carshowroom/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  Pagination,
  Select,
  StatePanel,
  type SelectOption,
} from "@/components/ui";
import {
  CarCard,
  CarCardSkeleton,
  CatalogSearch,
  FilterPanel,
  useCars,
  useCatalogFilters,
  useCatalogQuery,
} from "@/features/catalog";
import { useMediaQuery } from "@/shared/hooks";
import styles from "./CatalogPage.module.css";

/** С этой ширины появляется боковая панель фильтров (§7 design-system). */
const SIDE_PANEL_QUERY = "(min-width: 1024px)";

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
 * Каталог — UC-G2, раздел 3 docs/wireframes.md.
 *
 * Все фильтры, поиск, сортировка и страница живут в URL (`useCatalogQuery`),
 * поэтому страница сама состояния почти не держит: она читает запрос,
 * показывает результат и отдаёт изменения обратно в адрес.
 */
export default function CatalogPage() {
  const { query, setQuery, resetFilters, activeFilterCount } = useCatalogQuery();
  const filters = useCatalogFilters();
  const cars = useCars(query);
  const hasSidePanel = useMediaQuery(SIDE_PANEL_QUERY);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const total = cars.data?.total;

  const panel = (
    <FilterPanel
      query={query}
      filters={filters.data}
      onChange={setQuery}
      onReset={resetFilters}
      activeFilterCount={activeFilterCount}
      showReset={hasSidePanel}
      showSearch={hasSidePanel}
    />
  );

  const sort = (
    <Select
      options={SORT_OPTIONS}
      value={query.sort}
      aria-label="Сортировка"
      onValueChange={(value) => setQuery({ sort: value as CarSort })}
      className={styles.sort}
    />
  );

  function changePage(page: number) {
    setQuery({ page });
    // Страница листается кнопкой внизу списка: без этого следующая порция
    // открывается на своём хвосте.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Каталог</h1>
          <p className={styles.count}>
            {total === undefined ? "Подбираем автомобили…" : `${total} ${carsWord(total)}`}
          </p>
        </div>

        {hasSidePanel && (
          <label className={styles.sortField}>
            <span className={styles.sortLabel}>Сортировка</span>
            {sort}
          </label>
        )}
      </header>

      {/* Узкий экран: поиск строкой, фильтры — за кнопкой со счётчиком */}
      {!hasSidePanel && (
        <div className={styles.toolbar}>
          <CatalogSearch value={query.q} onChange={(q) => setQuery({ q })} withLabel={false} />

          <div className={styles.toolbarRow}>
            <Button
              iconStart={<SlidersHorizontal aria-hidden="true" />}
              onClick={() => setFiltersOpen(true)}
            >
              Фильтры
              {activeFilterCount > 0 && <span className={styles.badge}>{activeFilterCount}</span>}
            </Button>
            {sort}
          </div>
        </div>
      )}

      <div className={styles.layout}>
        {hasSidePanel && <aside className={styles.aside}>{panel}</aside>}

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

      {/* Панель фильтров на телефоне: лист снизу со строкой действий в подошве.
          Размещение, прокрутку тела, ловушку фокуса, Esc и возврат фокуса
          даёт Dialog из кита. */}
      {!hasSidePanel && (
        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogContent
            title="Фильтры"
            placement="sheet"
            footerClassName={styles.sheetActions}
            footer={
              <>
                <Button
                  variant="ghost"
                  disabled={activeFilterCount === 0}
                  iconStart={<RotateCcw aria-hidden="true" />}
                  onClick={resetFilters}
                >
                  Сбросить
                </Button>
                <Button
                  variant="primary"
                  loading={cars.isPending}
                  onClick={() => setFiltersOpen(false)}
                >
                  {total === undefined ? "Показать" : `Показать ${total}`}
                </Button>
              </>
            }
          >
            {panel}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
