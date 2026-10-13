import { Logger } from "@nestjs/common";

/**
 * Отправка писем через Resend (D27). Обычные функции, а не Nest-провайдер:
 * их вызывает Better Auth из auth/auth.ts, а тот собирается при импорте,
 * до NestFactory.create, — DI там ещё нет. По той же причине переменные
 * читаются из process.env напрямую; проверяет их parseConfig при старте Nest
 * (config/env.schema.ts).
 *
 * REST API простым fetch вместо SDK: один POST, ради него зависимость не нужна.
 */

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Ссылка из письма — её пишет лог в dev и читают тесты. */
  url: string;
};

const RESEND_URL = "https://api.resend.com/emails";
// не даём медленному Resend держать запрос регистрации бесконечно
const RESEND_TIMEOUT_MS = 10_000;
// outbox живёт в памяти процесса; dev-сервер работает часами — ограничиваем
const OUTBOX_LIMIT = 100;

const logger = new Logger("Mail");
const outbox: Mail[] = [];

export async function sendMail(mail: Mail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  // Без ключа (dev) письмо никуда не уходит: ссылка — в лог, чтобы пройти
  // сценарий руками, само письмо — в outbox, чтобы его нашли тесты. Тесты
  // в outbox пишут всегда: vitest читает тот же .env, что и dev-сервер, и с
  // настоящим ключом в нём e2e слали бы письма на e2e-адреса через Resend.
  if (!apiKey || process.env.NODE_ENV === "test") {
    outbox.push(mail);
    if (outbox.length > OUTBOX_LIMIT) outbox.shift();
    logger.log(
      `Письмо не отправлено (нет RESEND_API_KEY или NODE_ENV=test). ${mail.to}: ${mail.url}`,
    );
    return;
  }

  let response: Response;
  try {
    response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
  } catch (error) {
    logger.error(`Resend недоступен: ${(error as Error).message}`);
    throw new Error("Не удалось отправить письмо", { cause: error });
  }

  if (!response.ok) {
    // в теле ответа Resend — причина (неподтверждённый домен, лимит и т.п.);
    // ключ в лог не попадает: его нет ни в URL, ни в ответе
    logger.error(`Resend ответил ${response.status}: ${await response.text()}`);
    throw new Error(`Не удалось отправить письмо: Resend ответил ${response.status}`);
  }
}

/** Только для тестов: письма, «отправленные» без RESEND_API_KEY или в NODE_ENV=test. */
export function getOutbox(): readonly Mail[] {
  return outbox;
}

/** Только для тестов: последнее письмо на этот адрес. */
export function lastMailTo(email: string): Mail | undefined {
  return outbox.findLast((mail) => mail.to === email.toLowerCase());
}

/** Только для тестов. */
export function clearOutbox(): void {
  outbox.length = 0;
}
