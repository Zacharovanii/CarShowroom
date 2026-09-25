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
 *   400 PASSWORD_TOO_SHORT                    — новый пароль короче 8.
 */
export type AuthError = { code?: string; message?: string; status?: number } | null | undefined;

const NETWORK = "Не удалось связаться с сервером. Попробуйте ещё раз.";

function code(error: AuthError): string {
  return typeof error?.code === "string" ? error.code : "";
}

/**
 * UC-G6: сообщение общее. Не существует такого email или пароль не тот —
 * снаружи это должно выглядеть одинаково, иначе форма превращается
 * в проверку, зарегистрирован ли человек на сайте.
 */
export function signInErrorMessage(error: AuthError): string {
  if (code(error) === "INVALID_EMAIL_OR_PASSWORD" || error?.status === 401) {
    return "Неверный email или пароль.";
  }
  return NETWORK;
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
