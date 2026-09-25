import * as RadixSelect from "@radix-ui/react-select";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
}

/**
 * Клавиатура, типизация с клавиатуры, позиционирование списка и ARIA —
 * Radix Select. Свой здесь только внешний вид.
 */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Не выбрано",
  disabled = false,
  invalid = false,
  name,
  id,
  className,
  ...rest
}: SelectProps) {
  return (
    <RadixSelect.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
    >
      <RadixSelect.Trigger
        {...rest}
        id={id}
        aria-invalid={invalid || undefined}
        aria-disabled={disabled || undefined}
        className={clsx(styles.trigger, className)}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className={styles.chevron}>
          <ChevronDown aria-hidden="true" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content position="popper" sideOffset={4} className={styles.content}>
          <RadixSelect.Viewport className={styles.viewport}>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={styles.item}
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className={styles.indicator}>
                  <Check aria-hidden="true" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
