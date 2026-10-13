import { Controller, Get, Param, Res, StreamableFile } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { AppError } from "../common/app-error.js";
import { isValidKey } from "./media-path.js";
import { StorageService } from "./storage.service.js";

// Не тянем @types/express ради одной сигнатуры — нужен только setHeader().
interface HeaderResponseLike {
  setHeader(name: string, value: string): unknown;
}

// Маршрут для main.ts: /media/* живёт вне глобального префикса /api — это
// путь, который хранится в БД рядом с /assets/... и отдаётся фронту как есть
// (D26). Wildcard в синтаксисе path-to-regexp v8 (express 5): `*path`.
export const MEDIA_ROUTE = "media/*path";

// Фото из админки лежат в приватном бакете MinIO, наружу их отдаёт API.
// Ключ объекта не меняется (новый файл — новый uuid), поэтому ответ
// кешируется навсегда; 304 на If-None-Match не делаем — immutable-ответ
// браузер и так не перезапрашивает. Заголовок ставится только на найденный
// файл: @Header() действует и на ответ с ошибкой, и браузер запомнил бы 404
// навсегда — а файл по этому ключу ещё может появиться.
@Controller()
export class MediaController {
  constructor(private readonly storage: StorageService) {}

  // Фото каталога видит гость, а AuthGuard Better Auth глобальный.
  @AllowAnonymous()
  @Get(MEDIA_ROUTE)
  async getMedia(
    // В express 5 wildcard-параметр приходит массивом сегментов пути.
    @Param("path") segments: string[],
    @Res({ passthrough: true }) res: HeaderResponseLike,
  ): Promise<StreamableFile> {
    const key = segments.join("/");
    const object = isValidKey(key) ? await this.storage.get(key) : undefined;
    if (!object) throw new AppError("NOT_FOUND", "Файл не найден");

    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("ETag", object.etag);
    return new StreamableFile(object.stream, {
      type: object.contentType,
      length: object.contentLength,
    });
  }
}
