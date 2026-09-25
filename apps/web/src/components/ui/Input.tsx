import type { InputHTMLAttributes, Ref } from "react";
import clsx from "clsx";
import styles from "./Input.module.css";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Ошибка: ставит `aria-invalid` и красную границу. Текст ошибки рисует `Field`. */
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ invalid = false, disabled = false, className, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      aria-invalid={invalid || rest["aria-invalid"] || undefined}
      className={clsx(styles.input, className)}
    />
  );
}
