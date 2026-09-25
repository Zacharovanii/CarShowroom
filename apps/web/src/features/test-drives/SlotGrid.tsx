import type { Slot } from "@carshowroom/contracts";
import { Skeleton } from "@/components/ui";
import styles from "./SlotGrid.module.css";

export interface SlotGridProps {
  slots: Slot[];
  /** Время выбранного слота, «14:00»; `null` — ничего не выбрано. */
  value: string | null;
  onSelect: (slot: Slot) => void;
  /** Сетка сотрудника: состояния видны, выбрать нельзя (UC-M2). */
  readOnly?: boolean;
}

/** Состояние слота целиком приходит с сервера — TD-5 фронт не повторяет. */
function slotState(slot: Slot): "taken" | "early" | "free" {
  if (!slot.free) return "taken";
  if (!slot.bookable) return "early";
  return "free";
}

/**
 * Сетка из 9 слотов (TD-2). Каждое состояние подписано словами и отражено
 * в ARIA, а не только цветом: занятое время зачёркнуто, слишком близкое
 * помечено «рано», выбранное несёт `aria-pressed` (WCAG 1.4.1).
 */
export function SlotGrid({ slots, value, onSelect, readOnly = false }: SlotGridProps) {
  return (
    <ul className={styles.grid}>
      {slots.map((slot) => {
        const state = slotState(slot);
        const selected = slot.time === value;
        const disabled = readOnly || state !== "free";

        return (
          <li key={slot.startsAt}>
            <button
              type="button"
              data-state={state}
              data-selected={selected || undefined}
              // disabled снял бы слот с табуляции целиком, и человек на
              // клавиатуре не узнал бы, что это время вообще существует
              aria-disabled={disabled || undefined}
              aria-pressed={readOnly ? undefined : selected}
              className={styles.slot}
              onClick={() => {
                if (!disabled) onSelect(slot);
              }}
            >
              <span className={styles.time}>{slot.time}</span>
              {state === "taken" && <span className={styles.note}>занято</span>}
              {state === "early" && <span className={styles.note}>рано</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Заглушка сетки: те же 9 мест, чтобы блок не прыгал при загрузке. */
export function SlotGridSkeleton() {
  return (
    <div className={styles.grid} aria-busy="true">
      {Array.from({ length: 9 }, (_, index) => (
        <Skeleton key={index} variant="block" className={styles.skeleton} />
      ))}
    </div>
  );
}
