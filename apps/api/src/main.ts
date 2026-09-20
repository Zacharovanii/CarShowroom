import "./env.js";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  // Better Auth сам парсит body своих маршрутов (JSON) и переставляет
  // парсер Nest обратно для остальных — см. @thallesp/nestjs-better-auth.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Better Auth регистрирует /api/auth/* как raw middleware в обход роутера
  // Nest (httpAdapter.use, а не @Controller) — глобальный префикс его не
  // задевает, поэтому /api и basePath: "/api/auth" в auth.ts не удваиваются.
  app.setGlobalPrefix("api");

  // Без этого onModuleDestroy (закрытие пулов в DatabaseModule и AuthModule)
  // не вызывается на SIGTERM/SIGINT — docker compose down останавливал бы
  // процесс, не дав пулам закрыться.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
