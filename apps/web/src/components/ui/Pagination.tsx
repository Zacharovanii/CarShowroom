import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "./IconButton";
import styles from "./Pagination.module.css";

export interface PaginationProps {
  /** `page` и `totalPages` приходят из ответа контракта как есть. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label?: string;
  className?: string;
}

/**
 * Номера вокруг текущей страницы, первая и последняя всегда видны,
 * разрывы свёрнуты в многоточие: при десяти автомобилях это ровно
 * та полоса, которая нужна каталогу и списку пользователей.
 */
function pageItems(page: number, totalPages: number): Array<number | "gap"> {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const visible = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

  const items: Array<number | "gap"> = [];
  let previous = 0;

  for (const current of visible) {
    if (previous && current - previous > 1) items.push("gap");
    items.push(current);
    previous = current;
  }

  return items;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  label = "Страницы",
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label={label} className={clsx(styles.pagination, className)}>
      <IconButton
        label="Предыдущая страница"
        icon={<ChevronLeft />}
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      />

      <ol className={styles.list}>
        {pageItems(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className={styles.gap}>
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                className={styles.page}
                aria-current={item === page ? "page" : undefined}
                aria-label={`Страница ${item}`}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            </li>
          ),
        )}
      </ol>

      <IconButton
        label="Следующая страница"
        icon={<ChevronRight />}
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      />
    </nav>
  );
}
