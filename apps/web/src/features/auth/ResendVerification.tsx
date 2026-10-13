import { useEffect, useState, type FormEvent } from "react";
import { sendVerificationEmailSchema } from "@carshowroom/contracts";
import { Alert, Button, Field, Input } from "@/components/ui";
import { fieldErrors, type FieldErrors } from "@/shared/form";
import { sendVerificationEmail } from "./authClient";
import { requestErrorMessage } from "./authErrors";
import styles from "./AuthForm.module.css";

/** Пауза между письмами: бэкенд пускает 3 письма в минуту. */
const COOLDOWN_SECONDS = 60;

/** Обратный отсчёт в секундах; `restart` запускает его заново. */
function useCooldown(startNow: boolean) {
  const [left, setLeft] = useState(startNow ? COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  return { left, restart: () => setLeft(COOLDOWN_SECONDS) };
}

export interface ResendVerificationProps {
  /**
   * Адрес уже известен (после регистрации или попытки входа) — поля нет,
   * только кнопка. Без адреса показывается поле email: так повторное письмо
   * просят со страницы устаревшей ссылки.
   */
  email?: string;
  /** Письмо только что ушло само — кнопка сразу встаёт на паузу. */
  justSent?: boolean;
  label: string;
}

/**
 * Повторная отправка письма подтверждения. Ответ бэкенда одинаковый для
 * любого адреса, поэтому и сообщение об успехе ни о чём не проговаривается.
 */
export function ResendVerification({ email, justSent = false, label }: ResendVerificationProps) {
  const cooldown = useCooldown(justSent);
  const [typedEmail, setTypedEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"email">>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function send(address: string) {
    setAlert(null);
    setPending(true);
    const { error } = await sendVerificationEmail({ email: address });
    setPending(false);

    if (error) {
      setAlert(requestErrorMessage(error));
      return;
    }

    setSent(true);
    cooldown.restart();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = sendVerificationEmailSchema.safeParse({ email: email ?? typedEmail });
    if (!parsed.success) {
      setAlert(null);
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    void send(parsed.data.email);
  }

  const waiting = cooldown.left > 0;

  return (
    <form className={styles.resend} onSubmit={handleSubmit} noValidate>
      {email === undefined && (
        <Field label="Email" error={errors.email}>
          {(control) => (
            <Input
              {...control}
              type="email"
              name="email"
              autoComplete="email"
              value={typedEmail}
              onChange={(event) => setTypedEmail(event.target.value)}
            />
          )}
        </Field>
      )}

      {alert && <Alert variant="error">{alert}</Alert>}

      {sent && (
        <p role="status" className={styles.note}>
          {email === undefined
            ? "Если адрес зарегистрирован и ещё не подтверждён, мы отправили на него письмо."
            : "Письмо отправлено."}
        </p>
      )}

      <Button
        type="submit"
        variant={email === undefined ? "primary" : "secondary"}
        loading={pending}
        disabled={waiting}
        className={styles.submitWide}
      >
        {label}
      </Button>

      {/* Отсчёт — отдельной строкой: в кнопке (nowrap) он не помещается на 375 */}
      {waiting && <p className={styles.note}>Отправить снова можно через {cooldown.left} с.</p>}
    </form>
  );
}
