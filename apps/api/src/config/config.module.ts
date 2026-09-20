import { Global, Module } from "@nestjs/common";
import { parseConfig } from "./env.schema.js";

// AppConfig — не класс, а тип из z.infer, поэтому Nest не может вывести
// провайдера из типа параметра конструктора (метаданные декораторов стирают
// интерфейсы и type-алиасы до `Object`). Символ — токен, по которому
// провайдер запрашивают через @Inject(APP_CONFIG).
export const APP_CONFIG = Symbol("APP_CONFIG");

// @Global(), чтобы не импортировать ConfigModule в каждый модуль, которому
// нужна конфигурация (db, auth и т.д. читают её через один и тот же токен).
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useValue: parseConfig(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
