import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { slotSchema, slotsQuerySchema } from "@carshowroom/contracts";
import { shiftDay, toSalonDay } from "@/shared/format";

/** Горизонт записи TD-5: от сегодня до +30 дней. Лента дней ровно такая. */
const HORIZON_DAYS = 30;

/**
 * День и слот живут в адресе (UC-G4): ссылкой на «25 сентября, 14:00» можно
 * поделиться, «назад» возвращает предыдущий день, а вход с возвратом
 * приводит человека обратно на тот же слот — `?date=&time=` читает
 * и `features/auth/returnTo.ts`.
 *
 * Даты считаются только через `toSalonDay` и `shiftDay`: арифметика на `Date`
 * уехала бы в пояс браузера, и клиент из Владивостока увидел бы чужой «сегодня».
 */
export function useSlotSelection() {
  const [params, setParams] = useSearchParams();

  const today = toSalonDay();

  /** Ровно 31 день ленты: сегодня плюс горизонт TD-5. */
  const days = useMemo(
    () => Array.from({ length: HORIZON_DAYS + 1 }, (_, index) => shiftDay(today, index)),
    [today],
  );

  /**
   * Чужой или протухший параметр не роняет экран и не показывает день,
   * на который всё равно нельзя записаться: сбрасываемся к сегодняшнему.
   */
  const date = useMemo(() => {
    const parsed = slotsQuerySchema.shape.date.safeParse(params.get("date") ?? "");
    if (!parsed.success) return today;

    // Строки YYYY-MM-DD сравниваются лексикографически как даты
    const last = shiftDay(today, HORIZON_DAYS);
    return parsed.data >= today && parsed.data <= last ? parsed.data : today;
  }, [params, today]);

  const time = useMemo(() => {
    const parsed = slotSchema.shape.time.safeParse(params.get("time") ?? "");
    return parsed.success ? parsed.data : null;
  }, [params]);

  const update = useCallback(
    (next: { date: string; time: string | null }) => {
      const search = new URLSearchParams(params);
      search.set("date", next.date);
      if (next.time === null) search.delete("time");
      else search.set("time", next.time);
      // replace: выбор слота — не шаг истории, иначе «назад» из модалки
      // возвращало бы по одному клику на каждый перебранный слот
      setParams(search, { replace: true });
    },
    [params, setParams],
  );

  /** Смена дня всегда снимает выбор: в другом дне это уже другой слот. */
  const selectDate = useCallback((next: string) => update({ date: next, time: null }), [update]);
  const selectTime = useCallback(
    (next: string | null) => update({ date, time: next }),
    [update, date],
  );

  return { days, date, time, selectDate, selectTime };
}
