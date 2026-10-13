/**
 * Ошибки Better Auth. Его клиент отдаёт `{ data, error }`, а в `error`
 * лежит разобранное тело ответа вместе со статусом — плоским объектом,
 * без схемы. Поэтому читаем только `code` и `status`, а тексты берём свои:
 * сообщения Better Auth английские и человеку не показываются.
 *
 * Коды проверены живыми запросами к /api/auth (этап 5):
 *   401 INVALID_EMAIL_OR_PASSWORD             — неверная пара при входе;
 *   422 USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL — email занят;
 *   400 INVALID_PASSWORD                      — неверный текущий пароль;
 *   400 PASSWORD_TOO_SHORT                    — новый пароль короче 8;
 *   403 EMAIL_NOT_VERIFIED                    — вход с неподтверждённым email
 *                                               (письмо при этом уходит заново);
 *   401 INVALID_TOKEN / TOKEN_EXPIRED / USER_NOT_FOUND — ссылка подтверждения;
 *   400 INVALID_TOKEN                         — ссылка сброса пароля (неверная,
 *                                               истёкшая и использованная неразличимы);
 *   429 без code                              — rate limit (вход и регистрация
 *                                               5/мин, письма 3/мин).
 */
export type AuthError = { code?: string; message?: string; status?: number } | null | undefined;

const NETWORK = "Не удалось связаться с сервером. Попробуйте ещё раз.";
const RATE_LIMITED = "Слишком много попыток, попробуйте через минуту.";

function code(error: AuthError): string {
  return typeof error?.code === "string" ? error.code : "";
}

/**
 * UC-G6: сообщение общее. Не существует такого email или пароль не тот —
 * снаружи это должно выглядеть одинаково, иначе форма превращается
 * в проверку, зарегистрирован ли человек на сайте.
 */
export function signInErrorMessage(error: AuthError): string {
  if (error?.status === 429) return RATE_LIMITED;
  if (code(error) === "INVALID_EMAIL_OR_PASSWORD" || error?.status === 401) {
    return "Неверный email или пароль.";
  }
  return NETWORK;
}

/**
 * Пароль верный, но email не подтверждён. Better Auth в этот момент сам
 * отправляет новое письмо (sendOnSignIn), поэтому об этом и сообщаем.
 */
export function isEmailNotVerified(error: AuthError): boolean {
  return code(error) === "EMAIL_NOT_VERIFIED";
}

export function emailNotVerifiedMessage(email: string): string {
  return `Email не подтверждён. Мы отправили новое письмо на ${email} — перейдите по ссылке из него.`;
}

/**
 * Ошибка ссылки подтверждения: из ответа /verify-email или из `?error=`
 * в адресе, если Better Auth сделал редирект. Регистр кода не важен.
 */
export function verifyEmailErrorTitle(errorCode: string): string {
  const upper = errorCode.toUpperCase();
  if (upper === "TOKEN_EXPIRED") return "Ссылка устарела";
  if (upper === "INVALID_TOKEN" || upper === "USER_NOT_FOUND") return "Ссылка недействительна";
  return "Не удалось подтвердить email";
}

/** Ссылка сброса пароля неверная, истёкшая или уже использованная. */
export function isInvalidResetToken(error: AuthError): boolean {
  return code(error) === "INVALID_TOKEN";
}

/** Занятый email — ошибка поля email (UC-G5), остальное — плашка над формой. */
export function isEmailTaken(error: AuthError): boolean {
  return code(error) === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";
}

/** Неверный текущий пароль — ошибка своего поля, а не всей формы. */
export function isWrongCurrentPassword(error: AuthError): boolean {
  return code(error) === "INVALID_PASSWORD";
}

/**
 * Всё, что формой не разбирается по полям: сбой сети, 500, незнакомый код.
 * Текст один на все такие случаи — подробности человеку ничего не дают.
 */
export const REQUEST_FAILED = NETWORK;

/** То же, но превышение лимита запросов объясняется отдельно: повтор сразу не поможет. */
export function requestErrorMessage(error: AuthError): string {
  return error?.status === 429 ? RATE_LIMITED : NETWORK;
}

/** Код ошибки ответа — для разбора там, где одного «да/нет» мало. */
export function authErrorCode(error: AuthError): string {
  return code(error);
}
