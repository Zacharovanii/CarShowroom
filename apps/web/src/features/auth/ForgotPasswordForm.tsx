import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPasswordSchema } from "@carshowroom/contracts";
import { Alert, Button, Field, Input } from "@/components/ui";
import { fieldErrors, type FieldErrors } from "@/shared/form";
import { requestPasswordReset } from "./authClient";
import { requestErrorMessage } from "./authErrors";
import { AuthScreen } from "./AuthScreen";
import styles from "./AuthForm.module.css";

const BACK_TO_LOGIN = <Link to="/login">← Вернуться ко входу</Link>;

/**
 * Запрос ссылки для сброса пароля. Ответ бэкенда одинаковый для любого
 * адреса, поэтому и экран после отправки один: иначе форма показывала бы,
 * зарегистрирован ли человек. Ссылку в письме строит бэкенд — redirectTo
 * не передаётся.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"email">>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setAlert(null);
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setAlert(null);
    setPending(true);

    const { error } = await requestPasswordReset({ email: parsed.data.email });
    setPending(false);

    if (error) {
      setAlert(requestErrorMessage(error));
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <AuthScreen title="Проверьте почту" footer={BACK_TO_LOGIN}>
        <p className={styles.text}>
          Если такой адрес зарегистрирован, мы отправили на него письмо со ссылкой для сброса
          пароля. Ссылка действует 1 час.
        </p>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Восстановление пароля" footer={BACK_TO_LOGIN}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={styles.note}>Укажите email — пришлём ссылку, чтобы задать новый пароль.</p>

        {alert && <Alert variant="error">{alert}</Alert>}

        <Field label="Email" error={errors.email}>
          {(control) => (
            <Input
              {...control}
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>

        <Button type="submit" variant="primary" loading={pending} className={styles.submitWide}>
          Отправить ссылку
        </Button>
      </form>
    </AuthScreen>
  );
}
