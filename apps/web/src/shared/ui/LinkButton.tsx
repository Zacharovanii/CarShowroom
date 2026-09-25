import type { ReactNode } from "react";
import clsx from "clsx";
import { Link } from "react-router-dom";
import type { ButtonSize, ButtonVariant } from "@/components/ui";
import styles from "@/components/ui/Button.module.css";

export interface LinkButtonProps {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Кнопка, которая на самом деле ссылка. `Button` из кита рисует `<button>`
 * и режима `asChild` не имеет, а переход по `onClick` отнял бы у ссылки
 * middle-click, «открыть в новой вкладке» и адрес в строке состояния.
 *
 * Своих стилей здесь нет: берутся классы `Button.module.css` вместе с их
 * `data-variant` / `data-size`, поэтому кнопка и ссылка-кнопка не разъедутся.
 */
export function LinkButton({
  to,
  variant = "secondary",
  size = "md",
  iconStart,
  iconEnd,
  className,
  children,
}: LinkButtonProps) {
  return (
    <Link
      to={to}
      data-variant={variant}
      data-size={size}
      className={clsx(styles.button, className)}
    >
      <span className={styles.content}>
        {iconStart}
        {children}
        {iconEnd}
      </span>
    </Link>
  );
}
