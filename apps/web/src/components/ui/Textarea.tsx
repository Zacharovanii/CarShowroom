import { useState, type Ref, type TextareaHTMLAttributes } from "react";
import clsx from "clsx";
import styles from "./Textarea.module.css";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Ошибка: ставит `aria-invalid` и красную границу. Текст ошибки рисует `Field`. */
  invalid?: boolean;
  /** Счётчик «набрано / предел» под полем. Работает вместе с `maxLength`. */
  showCount?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * Многострочное поле на тех же токенах, что `Input`: граница, состояния
 * и ошибка ведут себя одинаково — иначе два поля в одной форме выглядят
 * из разных наборов.
 *
 * Счётчик символов необязателен и сам по себе ничего не ограничивает:
 * предел ставит `maxLength`, счётчик только показывает, сколько осталось.
 * Для скринридера он скрыт — предел уже объявлен самим `maxLength`,
 * а озвучивать число на каждую букву незачем.
 */
export function Textarea({
  invalid = false,
  disabled = false,
  showCount = false,
  className,
  onChange,
  ...rest
}: TextareaProps) {
  const { value, defaultValue, maxLength } = rest;

  // Черновик длины нужен только неуправляемому полю: у управляемого
  // длина уже есть в `value`, и своё состояние отстало бы от него.
  const [typedLength, setTypedLength] = useState(() => String(defaultValue ?? "").length);
  const length = typeof value === "string" ? value.length : typedLength;

  const field = (
    <textarea
      {...rest}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      aria-invalid={invalid || rest["aria-invalid"] || undefined}
      className={clsx(styles.textarea, className)}
      onChange={(event) => {
        if (showCount && typeof value !== "string") setTypedLength(event.target.value.length);
        onChange?.(event);
      }}
    />
  );

  if (!showCount) return field;

  return (
    <div className={styles.wrap}>
      {field}
      <span aria-hidden="true" className={styles.count}>
        {maxLength === undefined ? length : `${length} / ${maxLength}`}
      </span>
    </div>
  );
}
