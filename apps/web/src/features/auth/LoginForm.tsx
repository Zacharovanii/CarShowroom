import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signInSchema } from "@carshowroom/contracts";
import { Alert, Button, Field, Input, PasswordInput } from "@/components/ui";
import { fieldErrors, type FieldErrors } from "@/shared/form";
import { signIn } from "./authClient";
import { homeRouteForRole, toUserRole } from "./authContext";
import { emailNotVerifiedMessage, isEmailNotVerified, signInErrorMessage } from "./authErrors";
import { formatSlot, readReturnTo } from "./returnTo";
import { AuthScreen } from "./AuthScreen";
import { ResendVerification } from "./ResendVerification";
import styles from "./AuthForm.module.css";

/** UC-G6. Вход по email и паролю, возврат туда, откуда человека сюда отправили. */
export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = readReturnTo(location.state);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"email" | "password">>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** Пароль верный, но email не подтверждён: адрес, на который ушло новое письмо. */
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setAlert(null);
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setAlert(null);
    setUnverifiedEmail(null);
    setPending(true);

    const { data, error } = await signIn.email(parsed.data);

    if (error) {
      setPending(false);
      if (isEmailNotVerified(error)) {
        setUnverifiedEmail(parsed.data.email);
      } else {
        setAlert(signInErrorMessage(error));
      }
      return;
    }

    // Роль берётся из ответа, а не из контекста: сессия перечитывается
    // асинхронно и к моменту перехода может ещё не обновиться.
    navigate(returnTo ? returnTo.to : homeRouteForRole(toUserRole(data?.user.role)), {
      replace: true,
    });
  }

  return (
    <AuthScreen
      title="Вход"
      lead={
        returnTo?.slot && (
          <>Чтобы записаться на {formatSlot(returnTo.slot)}, войдите или зарегистрируйтесь.</>
        )
      }
      footer={
        <>
          Нет аккаунта?{" "}
          {/* Адрес возврата передаётся дальше: после регистрации человек
              должен попасть туда же, куда шёл до входа */}
          <Link to="/register" state={location.state}>
            Зарегистрироваться →
          </Link>
        </>
      }
    >
      {/* Отдельной формой над входом: у повторной отправки своя кнопка submit.
          key по адресу — для другого email отсчёт паузы начинается заново */}
      {unverifiedEmail && (
        <div className={styles.resend}>
          <Alert variant="warning">{emailNotVerifiedMessage(unverifiedEmail)}</Alert>
          <ResendVerification
            key={unverifiedEmail}
            email={unverifiedEmail}
            justSent
            label="Отправить письмо ещё раз"
          />
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
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

        <Field label="Пароль" error={errors.password}>
          {(control) => (
            <PasswordInput
              {...control}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        <Link to="/forgot-password" className={styles.forgot}>
          Забыли пароль?
        </Link>

        <Button type="submit" variant="primary" loading={pending} className={styles.submitWide}>
          Войти
        </Button>
      </form>
    </AuthScreen>
  );
}
