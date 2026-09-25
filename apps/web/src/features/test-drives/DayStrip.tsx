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
