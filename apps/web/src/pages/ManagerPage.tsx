import { useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { SALON_TIME_ZONE } from "@carshowroom/contracts";
import { Button, StatePanel } from "@/components/ui";
import {
  DayNav,
  ManagerFilters,
  TestDrivePanel,
  TestDriveTable,
  TestDriveTableSkeleton,
  useManagerDay,
  useManagerQuery,
} from "@/features/manager";
import { formatDate, shiftDay } from "@/shared/format";
import styles from "./ManagerPage.module.css";

/**
 * Рабочий день менеджера — UC-M1 и UC-M2, раздел 8 docs/wireframes.md.
 *
 * День и фильтры живут в адресе, отбор идёт на сервере, а весь расчёт
 * «что можно сделать с записью» приходит готовым в `started` и `status`.
 */
export default function ManagerPage() {
  const { query, setQuery, hasFilters } = useManagerQuery();
  const day = useManagerDay(query);

  /**
   * Список автомобилей для фильтра собирается из записей дня: эндпоинта
   * «все автомобили одним списком» нет, а `/api/cars` отдаёт страницами.
   * Берётся неотфильтрованный день, иначе выбор одного автомобиля вычистил
   * бы из списка все остальные. Без фильтров ключ запроса тот же,
   * что у `day`, — второго обращения к сети не будет.
   */
  const allOfDay = useManagerDay({ date: query.date });

  const [openedId, setOpenedId] = useState<number | null>(null);
  const opened = day.data?.items.find((item) => item.id === openedId) ?? null;

  const tomorrow = shiftDay(query.date, 1);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Записи на тест-драйв</h1>
        {/* Время всюду в поясе салона (TD-3) и подписано явно */}
        <p className={styles.zone}>Время московское · {SALON_TIME_ZONE}</p>
      </header>

      <div className={styles.toolbar}>
        <DayNav date={query.date} onChange={(date) => setQuery({ date })} />

        <div className={styles.filters}>
          <ManagerFilters
            carId={query.carId}
            status={query.status}
            items={allOfDay.data?.items ?? []}
            onChange={setQuery}
          />
          <p className={styles.total}>
            {day.data ? `Всего: ${day.data.items.length}` : "Считаем записи…"}
          </p>
        </div>
      </div>

      {day.isError ? (
        <StatePanel
          variant="error"
          title="Не удалось загрузить записи"
          description="Проверьте соединение и попробуйте снова."
          action={
            <Button variant="primary" loading={day.isFetching} onClick={() => day.refetch()}>
              Повторить
            </Button>
          }
        />
      ) : day.isPending ? (
        <TestDriveTableSkeleton />
      ) : day.data.items.length === 0 ? (
        <StatePanel
          title={`На ${formatDate(query.date)} записей нет`}
          description={
            hasFilters ? "Возможно, их скрывают фильтры." : "Выберите другой день в календаре."
          }
          action={
            <div className={styles.emptyActions}>
              {hasFilters && (
                <Button
                  iconStart={<RotateCcw aria-hidden="true" />}
                  onClick={() => setQuery({ carId: undefined, status: undefined })}
                >
                  Сбросить фильтры
                </Button>
              )}
              <Button
                variant="primary"
                iconEnd={<ArrowRight aria-hidden="true" />}
                onClick={() => setQuery({ date: tomorrow })}
              >
                Смотреть завтра
              </Button>
            </div>
          }
        />
      ) : (
        <TestDriveTable items={day.data.items} onOpen={(item) => setOpenedId(item.id)} />
      )}

      <TestDrivePanel item={opened} onClose={() => setOpenedId(null)} />
    </div>
  );
}
