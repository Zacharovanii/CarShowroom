import type { Mail } from "./mail.js";

/**
 * Письма Better Auth: подтверждение email и сброс пароля. Вёрстка —
 * простая таблица с инлайн-стилями: почтовые клиенты не знают ни CSS Modules,
 * ни токенов, а <style> многие вырезают. Text-версия — для клиентов без HTML
 * и для спам-фильтров, которые не любят письма из одного HTML.
 */

type Recipient = { name: string; email: string };

type Letter = {
  subject: string;
  /** Абзац над кнопкой. */
  lead: string;
  button: string;
};

const VERIFY: Letter = {
  subject: "Подтвердите email — CarShowroom",
  lead: "Вы зарегистрировались на сайте CarShowroom. Чтобы войти, подтвердите адрес электронной почты.",
  button: "Подтвердить email",
};

const RESET: Letter = {
  subject: "Восстановление пароля — CarShowroom",
  lead: "Кто-то запросил восстановление пароля для вашей учётной записи CarShowroom. Чтобы задать новый пароль, перейдите по ссылке.",
  button: "Задать новый пароль",
};

export function verifyEmailMail(user: Recipient, url: string): Mail {
  return compose(VERIFY, user, url);
}

export function resetPasswordMail(user: Recipient, url: string): Mail {
  return compose(RESET, user, url);
}

const EXPIRES = "Ссылка действует 1 час.";
const IGNORE = "Если это были не вы — просто проигнорируйте письмо.";

function compose(letter: Letter, user: Recipient, url: string): Mail {
  const greeting = user.name ? `Здравствуйте, ${user.name}!` : "Здравствуйте!";

  const text = [greeting, "", letter.lead, "", url, "", EXPIRES, IGNORE].join("\n");

  // имя приходит из формы регистрации — в HTML только экранированным
  const html = `<!doctype html>
<html lang="ru">
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px">
    <tr><td style="padding:32px">
      <p style="margin:0 0 16px;font-size:18px;font-weight:bold">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5">${escapeHtml(letter.lead)}</p>
      <p style="margin:0 0 24px">
        <a href="${escapeHtml(url)}"
          style="display:inline-block;padding:12px 24px;background:#1c69d4;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px">${escapeHtml(letter.button)}</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#52525b">Если кнопка не работает, скопируйте ссылку в адресную строку:<br>
        <a href="${escapeHtml(url)}" style="color:#1c69d4;word-break:break-all">${escapeHtml(url)}</a></p>
      <p style="margin:16px 0 0;font-size:13px;color:#52525b">${EXPIRES} ${IGNORE}</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { to: user.email, subject: letter.subject, html, text, url };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
