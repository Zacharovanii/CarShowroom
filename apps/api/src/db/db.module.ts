import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import postgres from "postgres";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.schema.js";

// Тип клиента postgres.js — структурный (не класс), поэтому его, как и
// AppConfig, можно получить из DI только через явный токен.
export type Sql = postgres.Sql;
export const SQL = Symbol("SQL");

// max=10 — решение D7.1: второе число (не значение по умолчанию), пара к
// max=5 у pg-пула модуля auth.
const MAX_CONNECTIONS = 10;

@Global()
@Module({
  providers: [
    {
      provide: SQL,
      // postgres(url, opts) — не класс, а фабричная функция: instance
      // строится вызовом, а не `new`, поэтому его нельзя оформить как
      // @Injectable(). useFactory просто вызывает эту функцию и отдаёт
      // Nest готовое значение, а inject подставляет в неё APP_CONFIG.
      useFactory: (config: AppConfig): Sql =>
        postgres(config.DATABASE_URL, {
          max: MAX_CONNECTIONS,
          // camelCase на границе с кодом (D-открытый вопрос раздела 9):
          // колонки БД остаются snake_case, репозитории получают camelCase
          // без `as "camelName"` в каждом запросе.
          transform: postgres.camel,
        }),
      inject: [APP_CONFIG],
    },
  ],
  exports: [SQL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async onModuleDestroy(): Promise<void> {
    await this.sql.end();
  }
}
