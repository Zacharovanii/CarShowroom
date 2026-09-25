import { useEffect, useRef } from "react";
import { formatDateWithYear, formatDayNumber, formatWeekday, toSalonDay } from "@/shared/format";
import styles from "./DayStrip.module.css";

export interface DayStripProps {
  /** Дни горизонта TD-5, `YYYY-MM-DD`, от сегодня и вперёд. */
  days: string[];
  value: string;
  onChange: (date: string) => void;
}

/**
 * Лента дней (UC-G4). Это группа радиокнопок, а не набор кнопок: выбран
 * ровно один день, и клавиатура должна ходить по ленте стрелками, а не
 * останавливаться на каждом из 31 дня по Tab.
 *
 * На телефоне лента прокручивается горизонтально; выбранный день
 * подтягивается в видимую часть, иначе после возврата со входа
 * (`?date=`) он остался бы за краем экрана.
 */
export function DayStrip({ days, value, onChange }: DayStripProps) {
  const strip = useRef<HTMLDivElement>(null);
  const selected = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    // Не `selected.current?.scrollIntoView(...)`: у радиокнопки нет своего
    // вертикального скролл-контейнера, и браузер прокрутил бы до неё саму
    // страницу — ленту сдвигаем горизонтально сами, окно не трогаем.
    const el = selected.current;
    const container = strip.current;
    if (!el || !container) return;

    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const target =
      elRect.left -
      containerRect.left +
      container.scrollLeft -
      (container.clientWidth - elRect.width) / 2;

    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [value]);

  // Колесо над лентой целиком принадлежит ей — и на краях тоже: если
  // отдавать остаток странице, инерция тачпада после края дёргает её.
  // Слушатель нативный: у React wheel пассивный, preventDefault в нём
  // не работает.
  //
  // Щелчки колеса копятся в одну цель и едут плавно: мгновенный шаг
  // в ~100px на щелчок выглядит рывком, а несколько плавных прокруток
  // подряд без общей цели съедают друг друга.
  useEffect(() => {
    const container = strip.current;
    if (!container) return;
    let target: number | null = null;
    let settle: ReturnType<typeof setTimeout> | undefined;

    function onWheel(event: WheelEvent) {
      if (!container) return;
      // Горизонтальный жест тачпада лента прокрутит сама
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const max = container.scrollWidth - container.clientWidth;
      if (max <= 0) return;

      event.preventDefault();
      // deltaMode 1 — строки (Firefox), а не пиксели
      const step = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      target = Math.min(Math.max((target ?? container.scrollLeft) + step, 0), max);
      container.scrollTo({ left: target, behavior: "smooth" });

      // Жест кончился — следующий считается от того места, где лента стоит
      clearTimeout(settle);
      settle = setTimeout(() => {
        target = null;
      }, 400);
    }

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      clearTimeout(settle);
    };
  }, []);

  const today = toSalonDay();

  return (
    <div ref={strip} className={styles.strip} role="radiogroup" aria-label="День тест-драйва">
      {days.map((day) => (
        <label
          key={day}
          ref={day === value ? selected : undefined}
          className={styles.day}
          data-selected={day === value || undefined}
        >
          <input
            type="radio"
            name="test-drive-day"
            className={styles.input}
            value={day}
            checked={day === value}
            onChange={() => onChange(day)}
          />
          {/* Скринридеру — полная дата: «вт 29» вне ленты ничего не значит */}
          <span className="visually-hidden">
            {day === today ? `Сегодня, ${formatDateWithYear(day)}` : formatDateWithYear(day)}
          </span>
          <span aria-hidden="true" className={styles.weekday}>
            {day === today ? "сегодня" : formatWeekday(day)}
          </span>
          <span aria-hidden="true" className={styles.number}>
            {formatDayNumber(day)}
          </span>
        </label>
      ))}
    </div>
  );
}
