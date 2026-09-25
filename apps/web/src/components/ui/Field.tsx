import { useId, type ReactNode } from "react";
import clsx from "clsx";
import { TriangleAlert } from "lucide-react";
import styles from "./Field.module.css";

/** Что `Field` передаёт контролу: связь подписи, подсказки и ошибки. */
export interface FieldControlProps {
  id: string;
  "aria-describedby": string | undefined;
  invalid: boolean;
}

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Обёртка поля: подпись, подсказка и ошибка связаны с контролом через
 * `id` и `aria-describedby`. Идентификаторы генерирует `useId`, поэтому
 * одно и то же поле можно поставить на страницу дважды.
 */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={clsx(styles.field, className)}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required && (
          <span className={styles.required}>
            <span aria-hidden="true">*</span>
            <span className="visually-hidden">обязательное поле</span>
          </span>
        )}
      </label>

      {children({ id, "aria-describedby": describedBy, invalid: Boolean(error) })}

      {error && (
        <span className={styles.error} id={errorId}>
          <TriangleAlert aria-hidden="true" />
          {error}
        </span>
      )}

      {hint && (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      )}
    </div>
  );
}
