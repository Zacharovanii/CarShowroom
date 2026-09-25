import type { CarDetails } from "@carshowroom/contracts";
import styles from "./CarSpecs.module.css";

export interface CarSpecsProps {
  car: CarDetails;
}

/** Привод человеческим языком: в контракте это `rwd` / `xdrive`. */
function driveLabel(drive: CarDetails["driveType"]): string {
  return drive === "xdrive" ? "xDrive" : "задний";
}

/**
 * Полоса характеристик страницы автомобиля (§9 design-system.md): значение
 * крупно, подпись под ним капсом. В отличие от каталога здесь полный набор —
 * `accelerationS` и `topSpeedKmh` приходят только в `carDetailsSchema`.
 *
 * Разгон остаётся строкой: numeric в БД → строка на проводе, и превращать
 * её в число ради вывода незачем.
 */
export function CarSpecs({ car }: CarSpecsProps) {
  const items: { value: string; label: string }[] = [
    { value: String(car.powerHp), label: "л.с." },
    { value: `${car.accelerationS} сек`, label: "0–100 км/ч" },
    { value: `${car.topSpeedKmh} км/ч`, label: "максимум" },
    { value: driveLabel(car.driveType), label: "привод" },
    { value: car.bodyTypeName, label: "кузов" },
    { value: car.fuelTypeName, label: "двигатель" },
    { value: String(car.modelYear), label: "год" },
  ];

  return (
    <dl className={styles.specs}>
      {items.map((item) => (
        <div key={item.label} className={styles.spec}>
          {/* В DOM подпись идёт первой: так требует разметка списка
              определений и так же читает её скринридер («л.с. — 340»).
              Визуальный порядок задаёт CSS. */}
          <dt className={styles.label}>{item.label}</dt>
          <dd className={styles.value}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
