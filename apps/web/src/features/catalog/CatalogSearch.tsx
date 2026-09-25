import { useCallback } from "react";
import clsx from "clsx";
import { Search } from "lucide-react";
import { Field, Input } from "@/components/ui";
import { useDebouncedField } from "@/shared/hooks";
import styles from "./CatalogSearch.module.css";

export interface CatalogSearchProps {
  /** Текущее значение `q` из URL. */
  value: string | undefined;
  onChange: (q: string | undefined) => void;
  /** С подписью — в боковой панели, без неё — в строке над сеткой на телефоне. */
  withLabel?: boolean;
  className?: string;
}

const PLACEHOLDER = "Например, X5";
const ARIA_LABEL = "Поиск по названию";

/**
 * Поиск по названию. Набранное уходит в URL с задержкой (`useDebouncedField`),
 * поэтому API не дёргается на каждую букву.
 */
export function CatalogSearch({
  value,
  onChange,
  withLabel = true,
  className,
}: CatalogSearchProps) {
  const commit = useCallback((next: string) => onChange(next.trim() || undefined), [onChange]);
  const [draft, setDraft] = useDebouncedField(value ?? "", commit);

  function field(id?: string) {
    return (
      <div className={clsx(styles.search, className)}>
        <Search aria-hidden="true" className={styles.icon} />
        <Input
          id={id}
          type="search"
          placeholder={PLACEHOLDER}
          aria-label={id ? undefined : ARIA_LABEL}
          className={styles.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
    );
  }

  if (!withLabel) return field();

  return <Field label="Поиск">{({ id }) => field(id)}</Field>;
}
