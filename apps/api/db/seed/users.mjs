import { hashPassword } from "better-auth/crypto";

// Тестовые пользователи всех трёх ролей (D16). Пароль один и тот же у всех —
// только для локальной разработки; на сервер seed пользователей не попадает
// (--catalog-only, D28).
const TEST_PASSWORD = "password123";

const USERS = [
  {
    name: "Тестовый клиент",
    email: "client@carshowroom.test",
    phone: "+79990000001",
    role: "user",
  },
  {
    name: "Тестовый менеджер",
    email: "manager@carshowroom.test",
    phone: "+79990000002",
    role: "manager",
  },
  { name: "Тестовый админ", email: "admin@carshowroom.test", phone: "+79990000003", role: "admin" },
];

// Пишем в users/accounts напрямую, а не через API Better Auth: seed выполняется
// до старта Nest, а хеш пароля должен быть таким же, каким его проверит вход
// по email/паролю (credential), поэтому берём тот же hashPassword, что и библиотека.
export async function seedUsers(client) {
  const passwordHash = await hashPassword(TEST_PASSWORD);

  for (const user of USERS) {
    const { rows } = await client.query(
      `insert into users (name, email, phone, role, email_verified)
       values ($1, $2, $3, $4, true)
       returning id`,
      [user.name, user.email, user.phone, user.role],
    );
    const userId = rows[0].id;

    // account_id у credential-входа — id самого пользователя (конвенция Better Auth).
    await client.query(
      `insert into accounts (user_id, provider_id, account_id, password)
       values ($1, 'credential', $2, $3)`,
      [userId, userId, passwordHash],
    );

    console.log(`  ${user.role.padEnd(7)} ${user.email} / ${TEST_PASSWORD}`);
  }
}
