import { useState, type FormEvent } from "react";
import { changePasswordFormSchema } from "@carshowroom/contracts";
import { Alert, Button, Card, Field, Input, useToast } from "@/components/ui";
import { fieldErrors, type FieldErrors } from "@/shared/form";
import { changePassword } from "./authClient";
import { isWrongCurrentPassword, REQUEST_FAILED } from "./authErrors";
import styles from "./AuthForm.module.css";

type Fields = "currentPassword" | "newPassword" | "confirmPassword";

/** UC-U2. Смена пароля: текущий + новый + подтверждение. */
export function PasswordForm() {
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = changePasswordFormSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      setAlert(null);
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setAlert(null);
    setPending(true);

    const { error } = await changePassword({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });
    setPending(false);

    if (error) {
      if (isWrongCurrentPassword(error)) {
        setErrors({ currentPassword: "неверный текущий пароль" });
      } else {
        setAlert(REQUEST_FAILED);
      }
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast({ tone: "success", description: "Пароль изменён" });
  }

  return (
    <Card>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.legend}>Смена пароля</h2>

        <Field label="Текущий пароль" error={errors.currentPassword}>
          {(control) => (
            <Input
              {...control}
              type="password"
              name="current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          )}
        </Field>

        <Field label="Новый пароль" error={errors.newPassword} hint="Не короче 8 символов">
          {(control) => (
            <Input
              {...control}
              type="password"
              name="new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          )}
        </Field>

        <Field label="Подтверждение" error={errors.confirmPassword}>
          {(control) => (
            <Input
              {...control}
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          )}
        </Field>

        {alert && <Alert variant="error">{alert}</Alert>}

        <div className={styles.actions}>
          <Button type="submit" variant="primary" loading={pending}>
            Сменить пароль
          </Button>
        </div>
      </form>
    </Card>
  );
}
