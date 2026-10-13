import { useId, useState, type FormEvent } from "react";
import { TriangleAlert } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { signUpFormSchema } from "@carshowroom/contracts";
import { Alert, Button, Checkbox, Field, Input, PasswordInput } from "@/components/ui";
import fieldStyles from "@/components/ui/Field.module.css";
import { fieldErrors, type FieldErrors } from "@/shared/form";
import { signUp } from "./authClient";
import { isEmailTaken, requestErrorMessage } from "./authErrors";
import { formatSlot, readReturnTo } from "./returnTo";
import { AuthScreen } from "./AuthScreen";
import { ResendVerification } from "./ResendVerification";
import styles from "./AuthForm.module.css";

type Fields = "name" | "email" | "phone" | "password" | "confirmPassword" | "consent";

/**
 * После регистрации — экран «Проверьте почту» вместо входа: email требует
 * подтверждения, сессии Better Auth не ставит, письмо уходит само.
 */
function CheckEmail({ email }: { email: string }) {
  const location = useLocation();

  return (
    <AuthScreen
      title="Проверьте почту"
      footer={
        <>
          Подтвердили email?{" "}
          <Link to="/login" state={location.state}>
            Войти →
          </Link>
        </>
      }
    >
      <p className={styles.text}>
        Мы отправили письмо на <strong>{email}</strong>. Перейдите по ссылке, чтобы подтвердить
        email. Ссылка действует 1 час.
      </p>
      <ResendVerification email={email} justSent label="Отправить ещё раз" />
    </AuthScreen>
  );
}

/**
 * UC-G5. Регистрация без входа: сначала нужно подтвердить email по ссылке
 * из письма, вход выполнится при переходе по ней (/verify-email).
 */
export function RegisterForm() {
  const location = useLocation();
  const returnTo = readReturnTo(location.state);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const consentErrorId = useId();
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** Адрес, на который ушло письмо: форма сменяется экраном «Проверьте почту». */
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = signUpFormSchema.safeParse({
      name,
      email,
      phone,
      password,
      confirmPassword,
      consent,
    });
    if (!parsed.success) {
      setAlert(null);
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setAlert(null);
    setPending(true);

    // confirmPassword и consent — правила формы, на провод они не уходят (contracts/auth.ts)
    const { error } = await signUp.email({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      password: parsed.data.password,
    });

    setPending(false);

    if (error) {
      // При обязательном подтверждении занятый email отвечает тем же 200,
      // что и новый (иначе форма выдавала бы, кто зарегистрирован), — ветка
      // осталась на случай, если подтверждение отключат.
      if (isEmailTaken(error)) {
        setErrors({ email: "такой email уже зарегистрирован" });
      } else {
        setAlert(requestErrorMessage(error));
      }
      return;
    }

    setRegisteredEmail(parsed.data.email);
  }

  if (registeredEmail) return <CheckEmail email={registeredEmail} />;

  return (
    <AuthScreen
      title="Регистрация"
      lead={
        returnTo?.slot && (
          <>Чтобы записаться на {formatSlot(returnTo.slot)}, войдите или зарегистрируйтесь.</>
        )
      }
      footer={
        <>
          Уже есть аккаунт?{" "}
          <Link to="/login" state={location.state}>
            Войти →
          </Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {alert && <Alert variant="error">{alert}</Alert>}

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

        <Field label="Телефон" error={errors.phone} hint="Формат +7XXXXXXXXXX">
          {(control) => (
            <Input
              {...control}
              type="tel"
              name="phone"
              autoComplete="tel"
              placeholder="+79991234567"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          )}
        </Field>

        <Field label="Пароль" error={errors.password} hint="Не короче 8 символов">
          {(control) => (
            <PasswordInput
              {...control}
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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

        {/* Заглушка согласия: текста соглашения в учебном проекте нет */}
        <div className={styles.consent}>
          <Checkbox
            name="consent"
            checked={consent}
            onCheckedChange={setConsent}
            invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? consentErrorId : undefined}
          >
            Я даю согласие на обработку персональных данных
          </Checkbox>
          {errors.consent && (
            <span className={fieldStyles.error} id={consentErrorId}>
              <TriangleAlert aria-hidden="true" />
              {errors.consent}
            </span>
          )}
        </div>

        <Button type="submit" variant="primary" loading={pending} className={styles.submitWide}>
          Зарегистрироваться
        </Button>
      </form>
    </AuthScreen>
  );
}
