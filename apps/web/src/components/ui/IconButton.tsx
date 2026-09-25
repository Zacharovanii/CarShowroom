import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from "react";
import clsx from "clsx";
import { Spinner } from "./Spinner";
import styles from "./IconButton.module.css";
import type { ButtonSize, ButtonVariant } from "./Button";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Обязательна: кнопка без текста должна называть себя скринридеру. */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  label,
  icon,
  variant = "secondary",
  size = "md",
  loading = false,
  disabled = false,
  type = "button",
  className,
  onClick,
  ...rest
}: IconButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
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
      aria-label={label}
      title={label}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-size={size}
      className={clsx(styles.button, className)}
      onClick={handleClick}
    >
      {loading ? <Spinner size={size === "sm" ? "sm" : "md"} label={null} /> : icon}
    </button>
  );
}
