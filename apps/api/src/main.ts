import "./env.js";
import { join } from "node:path";
import { RequestMethod } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { MEDIA_ROUTE } from "./storage/media.controller.js";

async function bootstrap() {
  // Better Auth сам парсит body своих маршрутов (JSON) и переставляет
  // парсер Nest обратно для остальных — см. @thallesp/nestjs-better-auth.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // Better Auth регистрирует /api/auth/* как raw middleware в обход роутера
  // Nest (httpAdapter.use, а не @Controller) — глобальный префикс его не
  // задевает, поэтому /api и basePath: "/api/auth" в auth.ts не удваиваются.
  // /media/* — не API, а раздача файлов рядом с /assets/... (D26). Nest
  // сверяет exclude с объявленным путём маршрута (path-to-regexp v8),
  // поэтому сюда идёт та же строка, что и в @Get контроллера.
  app.setGlobalPrefix("api", { exclude: [{ path: MEDIA_ROUTE, method: RequestMethod.GET }] });

  // Без этого onModuleDestroy (закрытие пулов в DatabaseModule и AuthModule)
  // не вызывается на SIGTERM/SIGINT — docker compose down останавливал бы
  // процесс, не дав пулам закрыться.
  app.enableShutdownHooks();

  // Фото и .glb раздаёт сам Nest — одинаково в dev и в проде (D15.1).
  // Лицензированные ассеты лежат вне гита в licensed-assets/ (D25); на чистом
  // клоне их нет, и вместо них отдаются заглушки из public/ — сайт не ломается.
  // Путь от dist/main.js: dist/ → apps/api/.
  const root = join(import.meta.dirname, "..");
  app.useStaticAssets(join(root, "licensed-assets"), { prefix: "/assets/" });
  app.useStaticAssets(join(root, "public"));
  const placeholder = (file: string) => (_req: unknown, res: { sendFile(path: string): void }) =>
    res.sendFile(join(root, "public", "assets", file));
  app.use("/assets/cars", placeholder("placeholder-car.webp"));
  app.use("/assets/models", placeholder("placeholder-car.glb"));

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
