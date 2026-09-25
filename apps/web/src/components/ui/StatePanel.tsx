import type { ReactNode } from "react";
import clsx from "clsx";
import { Inbox, TriangleAlert } from "lucide-react";
import { Spinner } from "./Spinner";
import styles from "./StatePanel.module.css";

export type StatePanelVariant = "empty" | "error" | "loading";

export interface StatePanelProps {
  variant?: StatePanelVariant;
  title: string;
  description?: ReactNode;
  /** Своя иконка вместо стандартной для варианта. */
  icon?: ReactNode;
  /** Обычно кнопка: «Сбросить фильтры», «Повторить». */
  action?: ReactNode;
  className?: string;
}

function defaultMark(variant: StatePanelVariant) {
  if (variant === "error") return <TriangleAlert aria-hidden="true" />;
  if (variant === "loading") return <Spinner label={null} />;
  return <Inbox aria-hidden="true" />;
}

/**
 * Пустой список, ошибка и загрузка — один компонент: экраны различаются
 * текстом, а не вёрсткой. В загрузке панель объявляет себя занятой,
 * поэтому состояние передаётся не только вращающимся кольцом.
 */
export function StatePanel({
  variant = "empty",
  title,
  description,
  icon,
  action,
  className,
}: StatePanelProps) {
  const isLoading = variant === "loading";

  return (
    <div
      data-variant={variant}
      role="status"
      aria-busy={isLoading || undefined}
      className={clsx(styles.panel, className)}
    >
      <span className={styles.mark}>{icon ?? defaultMark(variant)}</span>
      <strong className={styles.title}>{title}</strong>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
