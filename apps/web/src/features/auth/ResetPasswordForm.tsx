import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPasswordFormSchema } from "@carshowroom/contracts";
import { Alert, Button, Field, PasswordInput } from "@/components/ui";
import { fieldErrors, type FieldErrors } from "@/shared/form";
import { LinkButton } from "@/shared/ui/LinkButton";
import { resetPassword } from "./authClient";
import { isInvalidResetToken, requestErrorMessage } from "./authErrors";
import { AuthScreen } from "./AuthScreen";
import styles from "./AuthForm.module.css";

type Fields = "newPassword" | "confirmPassword";

const BACK_TO_LOGIN = <Link to="/login">← Вернуться ко входу</Link>;

/** Ссылка неверная, истёкшая или уже использованная — бэкенд их не различает. */
function InvalidLink() {
  return (
    <AuthScreen title="Ссылка недействительна" footer={BACK_TO_LOGIN}>
      <p className={styles.text}>
        Ссылка для сброса пароля недействительна или устарела. Запросите новую — она действует 1
        час.
      </p>
      <LinkButton to="/forgot-password" variant="primary" className={styles.submitWide}>
        Запросить новую
      </LinkButton>
    </AuthScreen>
  );
}

/**
 * Приёмник ссылки из письма: `/reset-password?token=…`. После смены пароля
 * бэкенд отзывает все сессии, поэтому дальше — обычный вход.
 */
export function ResetPasswordForm() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<"done" | "invalid" | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const parsed = resetPasswordFormSchema.safeParse({ newPassword, confirmPassword });
    if (!parsed.success) {
      setAlert(null);
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setAlert(null);
    setPending(true);

    // confirmPassword — правило формы, на провод уходят пароль и токен
    const { error } = await resetPassword({ newPassword: parsed.data.newPassword, token });
    setPending(false);

    if (error) {
      if (isInvalidResetToken(error)) {
        setOutcome("invalid");
      } else {
        setAlert(requestErrorMessage(error));
      }
      return;
    }

    setOutcome("done");
  }

  if (!token || outcome === "invalid") return <InvalidLink />;

  if (outcome === "done") {
    return (
      <AuthScreen title="Пароль изменён" footer={BACK_TO_LOGIN}>
        <p className={styles.text}>Войдите с новым паролем.</p>
        <LinkButton to="/login" variant="primary" className={styles.submitWide}>
          Войти
        </LinkButton>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Новый пароль" footer={BACK_TO_LOGIN}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {alert && <Alert variant="error">{alert}</Alert>}

        <Field label="Новый пароль" error={errors.newPassword} hint="Не короче 8 символов">
          {(control) => (
            <PasswordInput
              {...control}
              name="new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          )}
        </Field>

        <Field label="Подтверждение пароля" error={errors.confirmPassword}>
          {(control) => (
            <PasswordInput
              {...control}
              name="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          )}
        </Field>

        <Button type="submit" variant="primary" loading={pending} className={styles.submitWide}>
          Сохранить пароль
        </Button>
      </form>
    </AuthScreen>
  );
}
