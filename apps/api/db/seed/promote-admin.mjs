import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Первый админ на проде: пользователь регистрируется на сайте как обычно,
// подтверждает email, а этот скрипт меняет ему роль. Тестовых пользователей
// с публичным паролем на проде нет (seed --catalog-only).

// .env — как в run.mjs: нужен для локальной разработки, в проде переменные
// задаёт docker compose.
const here = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(here, "../../.env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Использование: node db/seed/promote-admin.mjs <email>");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();

  const {
    rows: [user],
  } = await client.query("select id, email_verified, role from users where email = $1", [email]);

  if (!user) {
    console.error(
      `Пользователь ${email} не найден. Сначала зарегистрируйтесь на сайте и подтвердите email.`,
    );
    process.exitCode = 1;
  } else if (!user.email_verified) {
    console.error("Email не подтверждён: перейдите по ссылке из письма, затем повторите.");
    process.exitCode = 1;
  } else if (user.role === "admin") {
    console.log(`${email} уже админ.`);
  } else {
    await client.query("update users set role = 'admin', updated_at = now() where id = $1", [
      user.id,
    ]);
    // Сессия хранит только id пользователя, а роль читается из users при каждом
    // запросе (cookieCache в auth.ts не включён) — перелогин не нужен.
    console.log(`${email} теперь админ. Обновите страницу сайта, чтобы роль применилась.`);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
