import { useMemo } from "react";
import {
  testDriveStatuses,
  type ManagerTestDrive,
  type TestDriveStatus,
} from "@carshowroom/contracts";
import { Select, TEST_DRIVE_STATUS_LABELS, type SelectOption } from "@/components/ui";
import styles from "./ManagerFilters.module.css";

/** Radix Select не принимает пустую строку значением, поэтому «любой» — слово. */
const ANY = "any";

const STATUS_OPTIONS: SelectOption[] = [
  { value: ANY, label: "Любой" },
  ...testDriveStatuses.map((status) => ({
    value: status,
    label: TEST_DRIVE_STATUS_LABELS[status],
  })),
];

export interface ManagerFiltersProps {
  carId?: number;
  status?: TestDriveStatus;
  /**
   * Записи дня — из них собирается список автомобилей. Отдельного эндпоинта
   * «все автомобили одним списком» нет, а `/api/cars` отдаёт страницами,
   * и вторая страница в фильтр бы не попала.
   */
  items: ManagerTestDrive[];
  onChange: (patch: { carId?: number; status?: TestDriveStatus }) => void;
}

export function ManagerFilters({ carId, status, items, onChange }: ManagerFiltersProps) {
  const carOptions = useMemo<SelectOption[]>(() => {
    const byId = new Map<number, string>();
    for (const item of items) byId.set(item.car.id, item.car.name);

    return [
      { value: ANY, label: "Любой" },
      ...[...byId].map(([id, name]) => ({ value: String(id), label: name })),
    ];
  }, [items]);

  return (
    <div className={styles.filters}>
      <label className={styles.field}>
        <span className={styles.label}>Автомобиль</span>
        <Select
          options={carOptions}
          value={carId === undefined ? ANY : String(carId)}
          onValueChange={(value) => onChange({ carId: value === ANY ? undefined : Number(value) })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Статус</span>
        <Select
          options={STATUS_OPTIONS}
          value={status ?? ANY}
          onValueChange={(value) =>
            onChange({ status: value === ANY ? undefined : (value as TestDriveStatus) })
          }
        />
      </label>
    </div>
  );
}
