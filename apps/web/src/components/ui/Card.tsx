import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import styles from "./Card.module.css";

export type CardVariant = "flat" | "interactive";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** `false` — содержимое ложится на поверхность без внутренних полей. */
  padded?: boolean;
  children?: ReactNode;
}

/**
 * Поверхность: фон и линия, без тени. Тень в системе есть только у того,
 * что оторвано от страницы, — у диалога и выпадающего списка (§1).
 */
export function Card({ variant = "flat", padded = true, className, children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      data-variant={variant}
      data-padded={padded || undefined}
      className={clsx(styles.card, className)}
    >
      {children}
    </div>
  );
}
