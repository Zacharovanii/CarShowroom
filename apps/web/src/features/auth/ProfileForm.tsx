import { useState, type FormEvent } from "react";
import { updateProfileSchema } from "@carshowroom/contracts";
import { Alert, Button, Card, Field, Input, useToast } from "@/components/ui";
import { fieldErrors, type FieldErrors } from "@/shared/form";
import { formatDateWithYear } from "@/shared/format";
import { updateUser } from "./authClient";
import { useAuth, type CurrentUser } from "./authContext";
import { REQUEST_FAILED } from "./authErrors";
import styles from "./AuthForm.module.css";

/**
 * UC-U2. Имя и телефон редактируются, email — только чтение: он же логин,
 * и смены email в сценариях нет.
 *
 * Сессию после сохранения не перечитываем руками: Better Auth сам объявляет
 * её устаревшей после /update-user, и `useSession` в AuthProvider обновляет
 * и шапку, и эту форму.
 */
function ProfileFields({ user }: { user: CurrentUser }) {
  const toast = useToast();

  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [errors, setErrors] = useState<FieldErrors<"name" | "phone">>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const changed = name !== user.name || phone !== user.phone;

  function reset() {
    setName(user.name);
    setPhone(user.phone);
    setErrors({});
    setAlert(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = updateProfileSchema.safeParse({ name, phone });
    if (!parsed.success) {
      setAlert(null);
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setAlert(null);
    setPending(true);

    const { error } = await updateUser(parsed.data);
    setPending(false);

    if (error) {
      setAlert(REQUEST_FAILED);
      return;
    }

    toast({ tone: "success", description: "Данные сохранены" });
  }

  return (
    <Card>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.legend}>Контактные данные</h2>

        <Field label="Имя" error={errors.name}>
          {(control) => (
            <Input
              {...control}
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        <Field label="Email" hint="Email изменить нельзя">
          {(control) => (
            <Input {...control} type="email" name="email" value={user.email} readOnly />
          )}
        </Field>

        <Field label="Телефон" error={errors.phone} hint="Формат +7XXXXXXXXXX">
          {(control) => (
            <Input
              {...control}
              type="tel"
              name="phone"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          )}
        </Field>

        <p className={styles.note}>В салоне с {formatDateWithYear(user.createdAt)}</p>

        {alert && <Alert variant="error">{alert}</Alert>}

        <div className={styles.actions}>
          <Button variant="ghost" disabled={!changed || pending} onClick={reset}>
            Отмена
          </Button>
          {/* Пока ничего не изменилось, сохранять нечего (раздел 7 макетов) */}
          <Button type="submit" variant="primary" disabled={!changed} loading={pending}>
            Сохранить
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function ProfileForm() {
  const { user } = useAuth();

  // Маршрут закрыт ProtectedRoute, но типу об этом неизвестно. Ключ по id
  // заодно пересоздаёт поля, если сессия сменилась на другого человека.
  if (!user) return null;

  return <ProfileFields key={user.id} user={user} />;
}
