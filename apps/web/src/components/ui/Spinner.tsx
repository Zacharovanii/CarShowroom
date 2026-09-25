import clsx from "clsx";
import styles from "./Spinner.module.css";

export type SpinnerSize = "sm" | "md";

export interface SpinnerProps {
  size?: SpinnerSize;
  /** Подпись для скринридера. `null` — спиннер декоративный (например, внутри кнопки). */
  label?: string | null;
  className?: string;
}

/**
 * Кольцо вращается бесконечно, поэтому цвет берёт из `currentColor`:
 * один и тот же спиннер стоит и на тёмной странице, и внутри светлой кнопки.
 */
export function Spinner({ size = "md", label = "Загрузка", className }: SpinnerProps) {
  if (label === null) {
    return <span aria-hidden="true" data-size={size} className={clsx(styles.spinner, className)} />;
  }

  return (
    <span role="status" className={clsx(styles.wrap, className)}>
      <span aria-hidden="true" data-size={size} className={styles.spinner} />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
