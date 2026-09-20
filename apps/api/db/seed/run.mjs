import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { seedUsers } from "./users.mjs";

// Тот же приём, что в src/env.ts: .env нужен для локальной разработки,
// в проде переменные задаёт docker compose — ENOENT не ошибка.
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

  console.log("Пользователи:");
  await seedUsers(client);

  await client.query("commit");
  console.log("Seed OK");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
