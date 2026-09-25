import type { ReactNode } from "react";
import clsx from "clsx";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import styles from "./Alert.module.css";

export type AlertVariant = "error" | "success" | "warning" | "info";

export interface AlertProps {
  variant?: AlertVariant;
  /** Своя иконка вместо стандартной для варианта. */
  icon?: ReactNode;
  /** Заголовок над текстом: нужен не всегда, одной строки обычно хватает. */
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

function defaultMark(variant: AlertVariant) {
  if (variant === "success") return <CircleCheck aria-hidden="true" />;
  if (variant === "info") return <Info aria-hidden="true" />;
  return <TriangleAlert aria-hidden="true" />;
}

/**
 * Сообщение на месте, а не тостом: ошибка всей формы, предупреждение рядом
 * с действием, подтверждение внутри диалога. `role="alert"` — плашка
 * появляется в ответ на действие и должна быть озвучена сразу.
 *
 * Тон передаётся не только цветом: у каждого варианта своя иконка и кромка
 * слева, поэтому сообщение читается и без различения оттенков (WCAG 1.4.1).
 */
export function Alert({ variant = "error", icon, title, children, className }: AlertProps) {
  return (
    <div role="alert" data-variant={variant} className={clsx(styles.alert, className)}>
      <span className={styles.mark}>{icon ?? defaultMark(variant)}</span>
      <div className={styles.text}>
        {title && <strong className={styles.title}>{title}</strong>}
        <p className={styles.description}>{children}</p>
      </div>
    </div>
  );
}
