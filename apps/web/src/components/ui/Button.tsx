import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from "react";
import clsx from "clsx";
import { Spinner } from "./Spinner";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Загрузка: ширина сохраняется, содержимое подменяется спиннером, фокус остаётся. */
  loading?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  type?: "button" | "submit" | "reset";
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled = false,
  iconStart,
  iconEnd,
  type = "button",
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // В загрузке кнопка НЕ получает disabled — иначе браузер снимет с неё фокус.
    // Поэтому клик отсекается руками.
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-size={size}
      className={clsx(styles.button, className)}
      onClick={handleClick}
    >
      <span className={styles.content}>
        {iconStart}
        {children}
        {iconEnd}
      </span>

      {loading && (
        <span className={styles.loader}>
          <Spinner size={size === "sm" ? "sm" : "md"} label={null} />
        </span>
      )}
    </button>
  );
}
