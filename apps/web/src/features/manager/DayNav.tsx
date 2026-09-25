import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, IconButton, Input } from "@/components/ui";
import { formatDateWithYear, shiftDay, toSalonDay } from "@/shared/format";
import styles from "./DayNav.module.css";

export interface DayNavProps {
  /** Календарный день пояса салона, `YYYY-MM-DD`. */
  date: string;
  onChange: (date: string) => void;
}

/**
 * Навигация по дням (UC-M1). Даты считаются только через `shiftDay` и
 * `toSalonDay`: арифметика на `Date` съехала бы в пояс браузера, и менеджер
 * во Владивостоке увидел бы «сегодня» на день вперёд.
 */
export function DayNav({ date, onChange }: DayNavProps) {
  const today = toSalonDay();

  return (
    <div className={styles.nav}>
      <div className={styles.buttons}>
        <IconButton
          label="Предыдущий день"
          icon={<ChevronLeft aria-hidden="true" />}
          onClick={() => onChange(shiftDay(date, -1))}
        />
        <Button
          variant={date === today ? "primary" : "secondary"}
          disabled={date === today}
          onClick={() => onChange(today)}
        >
          Сегодня
        </Button>
        <IconButton
          label="Следующий день"
          icon={<ChevronRight aria-hidden="true" />}
          onClick={() => onChange(shiftDay(date, 1))}
        />
      </div>

      {/* Подпись и поле выбора — одно целое: по клику открывается календарь,
          а читается всё равно «25 сентября 2026», а не «25.09.2026». */}
      <div className={styles.picker}>
        <span aria-hidden="true" className={styles.label}>
          {formatDateWithYear(date)}
        </span>
        <Input
          type="date"
          value={date}
          aria-label="Дата"
          className={styles.input}
          onChange={(event) => {
            // Пустое поле — промежуточное состояние набора, день не меняем
            if (event.target.value) onChange(event.target.value);
          }}
        />
      </div>
    </div>
  );
}
