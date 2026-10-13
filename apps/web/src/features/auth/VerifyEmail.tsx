import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Spinner, useToast } from "@/components/ui";
import { LinkButton } from "@/shared/ui/LinkButton";
import { getSession, verifyEmail } from "./authClient";
import { useAuth } from "./authContext";
import { authErrorCode, requestErrorMessage, verifyEmailErrorTitle } from "./authErrors";
import { AuthScreen } from "./AuthScreen";
import { ResendVerification } from "./ResendVerification";
import styles from "./AuthForm.module.css";

type Result =
  { kind: "verified"; signedIn: boolean } | { kind: "error"; code: string; message: string };

const BAD_LINK = "Запросите новое письмо — укажите email, который вводили при регистрации.";

/**
 * Приёмник ссылки из письма: `/verify-email?token=…`. Страница сама
 * вызывает GET /api/auth/verify-email (без callbackURL — иначе Better Auth
 * ответил бы редиректом). При первом переходе бэкенд подтверждает email
 * и ставит сессию (autoSignIn); при повторном — отвечает тем же 200, но
 * без сессии: email уже подтверждён, входа не происходит.
 *
 * `?error=CODE` разбирается так же — на случай, если ссылку когда-нибудь
 * откроют через редирект Better Auth.
 *
 * Маршрут не под GuestOnlyRoute: после автологина человек перестаёт быть
 * гостем, и страница не должна размонтироваться посреди процесса.
 */
export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const urlError = params.get("error");

  const navigate = useNavigate();
  const toast = useToast();
  const { isAuthenticated } = useAuth();

  const [result, setResult] = useState<Result | null>(null);
  /** Токен, по которому запрос уже ушёл: StrictMode запускает эффект дважды. */
  const requested = useRef<string | null>(null);

  useEffect(() => {
    if (!token || urlError || requested.current === token) return;
    requested.current = token;

    void (async () => {
      const { error } = await verifyEmail({ query: { token } });
      if (error) {
        const code = authErrorCode(error);
        setResult({ kind: "error", code, message: code ? BAD_LINK : requestErrorMessage(error) });
        return;
      }

      // Сессию useSession перечитает сам (Better Auth следит за /verify-email),
      // но момент, когда он это сделает, отсюда не виден. Чтобы отличить
      // первый переход от повторного, спрашиваем сессию напрямую.
      const session = await getSession();
      setResult({ kind: "verified", signedIn: Boolean(session.data?.session) });
    })();
  }, [token, urlError]);

  const signedIn = result?.kind === "verified" && result.signedIn;

  // В кабинет — только когда сессию увидел и AuthProvider: раньше
  // ProtectedRoute счёл бы человека гостем и отправил на /login.
  useEffect(() => {
    if (!signedIn || !isAuthenticated) return;
    toast({ tone: "success", description: "Email подтверждён" });
    navigate("/account", { replace: true });
  }, [signedIn, isAuthenticated, toast, navigate]);

  const state: Result | null = urlError
    ? { kind: "error", code: urlError, message: BAD_LINK }
    : !token
      ? { kind: "error", code: "INVALID_TOKEN", message: BAD_LINK }
      : result;

  if (state === null) {
    return (
      <AuthScreen title="Подтверждение email" footer={<Link to="/">На главную →</Link>}>
        <p role="status" className={styles.status}>
          <Spinner size="sm" label={null} />
          Подтверждаем email…
        </p>
      </AuthScreen>
    );
  }

  if (state.kind === "verified") {
    return (
      <AuthScreen title="Email подтверждён" footer={<Link to="/">На главную →</Link>}>
        {state.signedIn ? (
          <>
            <p className={styles.text}>Входим в личный кабинет…</p>
            <LinkButton to="/account" variant="primary" className={styles.submitWide}>
              В личный кабинет
            </LinkButton>
          </>
        ) : (
          <>
            <p className={styles.text}>Теперь войдите с email и паролем.</p>
            <LinkButton to="/login" variant="primary" className={styles.submitWide}>
              Войти
            </LinkButton>
          </>
        )}
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title={verifyEmailErrorTitle(state.code)}
      footer={
        <>
          Уже подтвердили email? <Link to="/login">Войти →</Link>
        </>
      }
    >
      <p className={styles.text}>{state.message}</p>
      <ResendVerification label="Выслать письмо заново" />
    </AuthScreen>
  );
}
