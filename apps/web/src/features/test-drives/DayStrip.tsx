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
  const selected = useRef<HTMLInputElement>(null);

  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [value]);

  const today = toSalonDay();

  return (
    <div className={styles.strip} role="radiogroup" aria-label="День тест-драйва">
      {days.map((day) => (
        <label key={day} className={styles.day} data-selected={day === value || undefined}>
          <input
            ref={day === value ? selected : undefined}
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
