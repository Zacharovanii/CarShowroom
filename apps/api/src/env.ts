// Импортируется первым в main.ts: должен выполниться раньше любого модуля,
// который на верхнем уровне читает process.env (auth/auth.ts — pg Pool и
// секрет Better Auth собираются при импорте, до NestFactory.create).
// В проде переменные задаёт docker compose, файла .env там нет — ENOENT не ошибка.
try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
