import { useId, type ReactNode } from "react";
import * as RadixCheckbox from "@radix-ui/react-checkbox";
import clsx from "clsx";
import { Check } from "lucide-react";
import styles from "./Checkbox.module.css";

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Текст рядом с квадратом. Без него нужен `aria-label`. */
  children?: ReactNode;
  name?: string;
  value?: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
}

/**
 * Поведение (клавиатура, `role="checkbox"`, состояние indeterminate)
 * берётся у Radix, стили — свои: у Radix их нет.
 */
export function Checkbox({
  checked,
  defaultChecked,
  onCheckedChange,
  children,
  disabled = false,
  invalid = false,
  id,
  className,
  ...rest
}: CheckboxProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;

  return (
    <div className={clsx(styles.row, className)}>
      <RadixCheckbox.Root
        {...rest}
        id={controlId}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={(next) => onCheckedChange?.(next === true)}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        aria-invalid={invalid || undefined}
        className={styles.box}
      >
        <RadixCheckbox.Indicator className={styles.indicator}>
          <Check aria-hidden="true" />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>

      {children && (
        <label className={styles.label} htmlFor={controlId}>
          {children}
        </label>
      )}
    </div>
  );
}
