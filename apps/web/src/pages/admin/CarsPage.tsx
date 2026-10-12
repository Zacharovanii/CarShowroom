import { useCallback } from "react";
import { Plus, RotateCcw, Search } from "lucide-react";
import { adminCarStatuses, type AdminCarStatus } from "@carshowroom/contracts";
import {
  Button,
  Field,
  Input,
  Pagination,
  Select,
  StatePanel,
  type SelectOption,
} from "@/components/ui";
import {
  ADMIN_CAR_STATUS_LABELS,
  AdminCarsList,
  AdminCarsListSkeleton,
  useAdminCars,
  useAdminCarsQuery,
} from "@/features/admin-cars";
import { useDebouncedField, useMediaQuery } from "@/shared/hooks";
import { LinkButton } from "@/shared/ui/LinkButton";
import styles from "./CarsPage.module.css";

/** Ниже этой ширины таблица становится карточками — как у пользователей. */
const TABLE_QUERY = "(min-width: 640px)";

const NEW_CAR_PATH = "/admin/cars/new";

const STATUS_OPTIONS: SelectOption[] = adminCarStatuses.map((status) => ({
  value: status,
  label: ADMIN_CAR_STATUS_LABELS[status],
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
 * Автомобили — UC-A3: список карточек каталога в любом статусе.
 *
 * Устроена как страница пользователей: поиск, статус и страница живут
 * в URL (`useAdminCarsQuery`), страница только читает запрос и отдаёт
 * изменения обратно в адрес. Маршрут закрыт по роли в AppRoutes.
 */
export default function CarsPage() {
  const { query, setQuery, resetFilters, hasFilters } = useAdminCarsQuery();
  const cars = useAdminCars(query);
  const hasTable = useMediaQuery(TABLE_QUERY);

  // Набранное уезжает в URL с задержкой: иначе API дёргался бы на каждую
  // букву, а история зарастала бы промежуточными адресами.
  const commitSearch = useCallback(
    (next: string) => setQuery({ q: next.trim() || undefined }),
    [setQuery],
  );
  const [draft, setDraft] = useDebouncedField(query.q ?? "", commitSearch);

  const total = cars.data?.total;

  const addButton = (
    <LinkButton to={NEW_CAR_PATH} variant="primary" iconStart={<Plus aria-hidden="true" />}>
      Добавить автомобиль
    </LinkButton>
  );

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Автомобили</h1>
          <p className={styles.count}>
            {total === undefined ? "Загружаем список…" : `${total} ${carsWord(total)}`}
          </p>
        </div>

        {addButton}
      </header>

      <div className={styles.toolbar}>
        <Field label="Поиск">
          {(control) => (
            <div className={styles.search}>
              <Search aria-hidden="true" className={styles.searchIcon} />
              <Input
                {...control}
                type="search"
                placeholder="Название или slug"
                className={styles.searchInput}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
          )}
        </Field>

        <Field label="Статус">
          {(control) => (
            <Select
              {...control}
              options={STATUS_OPTIONS}
              value={query.status}
              onValueChange={(value) => setQuery({ status: value as AdminCarStatus })}
            />
          )}
        </Field>
      </div>

      {cars.isError ? (
        <StatePanel
          variant="error"
          title="Не удалось загрузить автомобили"
          description="Проверьте соединение и попробуйте снова."
          action={
            <Button variant="primary" loading={cars.isFetching} onClick={() => cars.refetch()}>
              Повторить
            </Button>
          }
        />
      ) : cars.isPending ? (
        <AdminCarsListSkeleton compact={!hasTable} />
      ) : cars.data.items.length === 0 ? (
        // Пусто бывает и без отбора: по чужой ссылке со страницей, которой
        // в текущей выборке уже нет. Тогда это не «пусто», а «не найдено».
        hasFilters || query.page > 1 ? (
          <StatePanel
            title="Ничего не найдено"
            description="Попробуйте изменить поиск или снять фильтр по статусу."
            action={
              <Button
                variant="primary"
                iconStart={<RotateCcw aria-hidden="true" />}
                onClick={resetFilters}
              >
                Сбросить фильтры
              </Button>
            }
          />
        ) : (
          <StatePanel
            title="Автомобилей пока нет"
            description="Добавьте первый: он появится здесь черновиком, а в каталоге — после публикации."
            action={addButton}
          />
        )
      ) : (
        <>
          <AdminCarsList cars={cars.data.items} compact={!hasTable} />

          <Pagination
            page={cars.data.page}
            totalPages={cars.data.totalPages}
            onPageChange={(page) => setQuery({ page })}
            label="Страницы списка автомобилей"
            className={styles.pagination}
          />
        </>
      )}
    </div>
  );
}
