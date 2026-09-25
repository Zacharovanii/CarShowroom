import { useCallback } from "react";
import { Field, Input } from "@/components/ui";
import { useDebouncedField } from "@/shared/hooks";
import styles from "./PriceRange.module.css";

export interface PriceRangeProps {
  /** Деньги — строка, как в контракте: числом они здесь не становятся (D12). */
  min: string | undefined;
  max: string | undefined;
  onChange: (range: { priceMin?: string; priceMax?: string }) => void;
}

/**
 * Два поля «от» и «до» вместо ползунка с двумя рукоятками (§8 design-system):
 * фильтром цены в каталоге из десяти машин пользуются один раз, а ARIA
 * и клавиатура у ползунка — отдельная история.
 *
 * В поле остаются только цифры. Контракт принимает и копейки, но пустой
 * ввод вроде «5000000.» схему не пройдёт, а API ответит 400 — проще
 * не пускать в URL то, чего он не примет.
 */
function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function PriceRange({ min, max, onChange }: PriceRangeProps) {
  const commitMin = useCallback(
    (next: string) => onChange({ priceMin: next || undefined }),
    [onChange],
  );
  const commitMax = useCallback(
    (next: string) => onChange({ priceMax: next || undefined }),
    [onChange],
  );

  const [minDraft, setMinDraft] = useDebouncedField(min ?? "", commitMin);
  const [maxDraft, setMaxDraft] = useDebouncedField(max ?? "", commitMax);

  return (
    <Field label="Цена, ₽">
      {({ id }) => (
        <div className={styles.range}>
          <Input
            id={id}
            type="text"
            inputMode="numeric"
            placeholder="от"
            aria-label="Цена от"
            value={minDraft}
            onChange={(event) => setMinDraft(onlyDigits(event.target.value))}
          />
          <span aria-hidden="true" className={styles.dash} />
          <Input
            type="text"
            inputMode="numeric"
            placeholder="до"
            aria-label="Цена до"
            value={maxDraft}
            onChange={(event) => setMaxDraft(onlyDigits(event.target.value))}
          />
        </div>
      )}
    </Field>
  );
}
