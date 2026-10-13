import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { seedTestDrives } from "./test-drives.mjs";
import { seedUsers } from "./users.mjs";

// Тот же приём, что в src/env.ts: .env нужен для локальной разработки,
// в проде переменные задаёт docker compose — ENOENT не ошибка.
// --catalog-only — для прода: только каталог, без тестовых пользователей
// (у них публичный пароль) и тест-драйвов. Любой другой аргумент — ошибка,
// чтобы опечатка во флаге не залила тестовых пользователей.
const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg !== "--catalog-only");
if (unknown.length > 0) {
  console.error(`Неизвестный аргумент: ${unknown.join(" ")}`);
  console.error("Использование: node db/seed/run.mjs [--catalog-only]");
  process.exit(1);
}
const catalogOnly = args.includes("--catalog-only");

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(here, "../../.env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("begin");

  console.log("Каталог:");
  const catalogSql = readFileSync(path.join(here, "catalog.sql"), "utf8");
  await client.query(catalogSql);
  const {
    rows: [{ count }],
  } = await client.query("select count(*)::int from cars");
  console.log(`  ${count} автомобилей`);

  if (catalogOnly) {
    console.log("Пользователи и тест-драйвы пропущены (--catalog-only)");
  } else {
    console.log("Пользователи:");
    await seedUsers(client);

    console.log("Тест-драйвы:");
    await seedTestDrives(client);
  }

  await client.query("commit");
  console.log("Seed OK");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
