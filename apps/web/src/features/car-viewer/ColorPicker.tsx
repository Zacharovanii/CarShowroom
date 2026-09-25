import type { CarColor } from "@carshowroom/contracts";
import styles from "./ColorPicker.module.css";

export interface ColorPickerProps {
  colors: CarColor[];
  selected: CarColor;
  onSelect: (color: CarColor) => void;
}

/**
 * Палитра кузова (раздел 4 wireframes.md).
 *
 * Кружок — обычная кнопка с `aria-pressed`, а выбранный цвет назван рядом
 * словами: цветом кружка состояние не передаётся, и название цвета человеку
 * всё равно нужно — «Alpine White» по пятну не прочитать.
 *
 * `hex` идёт инлайновым стилем, и это единственное место, где цвет не из
 * токенов: это данные автомобиля из базы, а не оформление интерфейса.
 */
export function ColorPicker({ colors, selected, onSelect }: ColorPickerProps) {
  return (
    <div className={styles.picker}>
      <div className={styles.head}>
        <span className={styles.label} id="car-color-label">
          Цвет кузова
        </span>
        <span className={styles.name}>{selected.name}</span>
      </div>

      <div className={styles.swatches} role="group" aria-labelledby="car-color-label">
        {colors.map((color) => (
          <button
            key={color.id}
            type="button"
            className={styles.swatch}
            aria-pressed={color.id === selected.id}
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
