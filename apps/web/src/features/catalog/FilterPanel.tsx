import { useId } from "react";
import clsx from "clsx";
import { RotateCcw } from "lucide-react";
import {
  driveTypes,
  type CarsQuery,
  type CatalogFilters,
  type DriveType,
  type FilterOption,
} from "@carshowroom/contracts";
import { Button, Field, Select, type SelectOption } from "@/components/ui";
import { CatalogSearch } from "./CatalogSearch";
import { PriceRange } from "./PriceRange";
import styles from "./FilterPanel.module.css";

/**
 * «Не выбрано» у Radix Select не может быть пустой строкой, поэтому у
 * варианта «любой» есть своё значение, которое наружу уходит как `undefined`.
 */
const ANY = "any";

const DRIVE_LABELS: Record<DriveType, string> = {
  rwd: "Задний",
  xdrive: "xDrive",
};

function toOptions(items: FilterOption[] | undefined, anyLabel: string): SelectOption[] {
  return [
    { value: ANY, label: anyLabel },
    ...(items ?? []).map((item) => ({ value: String(item.id), label: item.name })),
  ];
}

export interface FilterPanelProps {
  query: CarsQuery;
  /** Справочники приходят отдельным запросом; пока их нет — списки пустые. */
  filters: CatalogFilters | undefined;
  onChange: (patch: Partial<CarsQuery>) => void;
  onReset: () => void;
  activeFilterCount: number;
  /** На телефоне «Сбросить» живёт в липкой строке панели, а не в самих фильтрах. */
  showReset?: boolean;
  /** На телефоне поиск стоит в строке над сеткой, и в панели его нет. */
  showSearch?: boolean;
  className?: string;
}

/**
 * Панель фильтров каталога. Своего состояния
 * почти не держит: значения приходят из URL и туда же возвращаются. Исключение —
 * черновики поиска и цены, которые ждут паузы в наборе (`useDebouncedField`).
 */
export function FilterPanel({
  query,
  filters,
  onChange,
  onReset,
  activeFilterCount,
  showReset = true,
  showSearch = true,
  className,
}: FilterPanelProps) {
  const driveName = useId();

  /** В URL уходит id строки справочника, а не имя (D19). */
  function toId(value: string): number | undefined {
    return value === ANY ? undefined : Number(value);
  }

  return (
    <div className={clsx(styles.panel, className)}>
      {showSearch && <CatalogSearch value={query.q} onChange={(q) => onChange({ q })} />}

      <Field label="Серия">
        {({ id }) => (
          <Select
            id={id}
            options={toOptions(filters?.series, "Любая")}
            value={query.series === undefined ? ANY : String(query.series)}
            onValueChange={(value) => onChange({ series: toId(value) })}
          />
        )}
      </Field>

      <Field label="Кузов">
        {({ id }) => (
          <Select
            id={id}
            options={toOptions(filters?.bodyTypes, "Любой")}
            value={query.body === undefined ? ANY : String(query.body)}
            onValueChange={(value) => onChange({ body: toId(value) })}
          />
        )}
      </Field>

      <Field label="Двигатель">
        {({ id }) => (
          <Select
            id={id}
            options={toOptions(filters?.fuelTypes, "Любой")}
            value={query.fuel === undefined ? ANY : String(query.fuel)}
            onValueChange={(value) => onChange({ fuel: toId(value) })}
          />
        )}
      </Field>

      {/* Привод — переключатель из трёх положений. Внутри честные radio:
          у них даром и стрелки на клавиатуре, и объявление «выбрано». */}
      <fieldset className={styles.drive}>
        <legend className={styles.legend}>Привод</legend>

        <div className={styles.segment}>
          <label className={styles.option}>
            <input
              type="radio"
              name={driveName}
              className={styles.radio}
              checked={query.drive === undefined}
              onChange={() => onChange({ drive: undefined })}
            />
            <span className={styles.optionLabel}>Любой</span>
          </label>

          {driveTypes.map((drive) => (
            <label key={drive} className={styles.option}>
              <input
                type="radio"
                name={driveName}
                className={styles.radio}
                checked={query.drive === drive}
                onChange={() => onChange({ drive })}
              />
              <span className={styles.optionLabel}>{DRIVE_LABELS[drive]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <PriceRange min={query.priceMin} max={query.priceMax} onChange={onChange} />

      {/* Сброс появляется, только когда сбрасывать есть что */}
      {showReset && activeFilterCount > 0 && (
        <Button variant="ghost" iconStart={<RotateCcw aria-hidden="true" />} onClick={onReset}>
          Сбросить
        </Button>
      )}
    </div>
  );
}
