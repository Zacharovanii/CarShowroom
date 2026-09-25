import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "./Input";
import styles from "./PasswordInput.module.css";

export type PasswordInputProps = Omit<InputProps, "type">;

/**
 * Поле пароля с кнопкой «показать». Кнопка — обычная `<button>` внутри
 * поля справа, с `aria-pressed` и подписью: скринридер слышит, скрыт
 * пароль или виден. Из табуляции она не убрана — это такое же действие,
 * как любое другое.
 */
export function PasswordInput({ className, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Скрыть пароль" : "Показать пароль";

  return (
    <div className={styles.wrap}>
      <Input {...rest} type={visible ? "text" : "password"} className={className} />
      <button
        type="button"
        className={styles.toggle}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        disabled={rest.disabled}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
  );
}
