import type { ReactNode } from "react";
import clsx from "clsx";
import styles from "./Badge.module.css";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface BadgeProps {
  tone?: BadgeTone;
  /** Точка перед подписью — знак статуса, который не зависит от цвета. */
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", dot = false, icon, children, className }: BadgeProps) {
  return (
    <span data-tone={tone} className={clsx(styles.badge, className)}>
      {dot && <span aria-hidden="true" className={styles.dot} />}
      {icon}
      {children}
    </span>
  );
}
