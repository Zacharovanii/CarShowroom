import "./env.js";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  // Better Auth сам парсит body своих маршрутов (JSON) и переставляет
  // парсер Nest обратно для остальных — см. @thallesp/nestjs-better-auth.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
