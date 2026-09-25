import type { CarColor } from "@carshowroom/contracts";
import styles from "./ColorPicker.module.css";

export interface ColorPickerProps {
  colors: CarColor[];
  /** Родной цвет краски из самой модели — первый кружок, выбран по умолчанию. */
  originalHex: string;
  /** `null` — выбран родной цвет модели. */
  selected: CarColor | null;
  onSelect: (color: CarColor | null) => void;
}

const ORIGINAL_NAME = "Оригинальный";

/**
 * Палитра кузова.
 *
 * Первый кружок — цвет, в котором модель сделана автором: его нет в базе,
 * он читается из GLB. Остальные — палитра автомобиля из базы.
 *
 * Кружок — обычная кнопка с `aria-pressed`, а выбранный цвет назван рядом
 * словами: цветом кружка состояние не передаётся.
 *
 * `hex` идёт инлайновым стилем, и это единственное место, где цвет не из
 * токенов: это данные автомобиля, а не оформление интерфейса.
 */
export function ColorPicker({ colors, originalHex, selected, onSelect }: ColorPickerProps) {
  return (
    <div className={styles.picker}>
      <div className={styles.head}>
        <span className={styles.label} id="car-color-label">
          Цвет кузова
        </span>
        <span className={styles.name}>{selected?.name ?? ORIGINAL_NAME}</span>
      </div>

      <div className={styles.swatches} role="group" aria-labelledby="car-color-label">
        <button
          type="button"
          className={styles.swatch}
          aria-pressed={selected === null}
          title={ORIGINAL_NAME}
          onClick={() => onSelect(null)}
        >
          <span
            className={styles.dot}
            style={{ backgroundColor: originalHex }}
            aria-hidden="true"
          />
          <span className="visually-hidden">{ORIGINAL_NAME}</span>
        </button>

        {colors.map((color) => (
          <button
            key={color.id}
            type="button"
            className={styles.swatch}
            aria-pressed={color.id === selected?.id}
            title={color.name}
            onClick={() => onSelect(color)}
          >
            <span
              className={styles.dot}
              style={{ backgroundColor: color.hex }}
              aria-hidden="true"
            />
            <span className="visually-hidden">{color.name}</span>
          </button>
        ))}
      </div>

      <p className={styles.note}>Цвет меняется только на модели — на цену это не влияет.</p>
    </div>
  );
}
