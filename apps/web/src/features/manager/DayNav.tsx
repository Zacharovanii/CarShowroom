import { useRef } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, IconButton } from "@/components/ui";
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
 *
 * Выбор даты — кнопка с текущим днём словами; календарь по клику —
 * браузерный, от спрятанного под кнопкой поля даты (`showPicker`).
 */
export function DayNav({ date, onChange }: DayNavProps) {
  const today = toSalonDay();
  const picker = useRef<HTMLInputElement>(null);

  function openCalendar() {
    const input = picker.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      // Браузер без showPicker для даты — фокус на поле, календарь по Alt+↓
      input.focus();
    }
  }

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

      <div className={styles.picker}>
        <Button
          variant="ghost"
          iconStart={<CalendarDays aria-hidden="true" />}
          className={styles.dateButton}
          aria-label={`${formatDateWithYear(date)}, выбрать другую дату`}
          onClick={openCalendar}
        >
          {formatDateWithYear(date)}
        </Button>
        {/* Поле нужно только как источник календаря браузера: скрыто под
            кнопкой, чтобы календарь открывался у неё, и из табуляции убрано —
            с клавиатуры дату выбирают той же кнопкой */}
        <input
          ref={picker}
          type="date"
          value={date}
          tabIndex={-1}
          aria-hidden="true"
          className={styles.input}
          onChange={(event) => {
            // Пустое значение — промежуточное состояние набора, день не меняем
            if (event.target.value) onChange(event.target.value);
          }}
        />
      </div>
    </div>
  );
}
