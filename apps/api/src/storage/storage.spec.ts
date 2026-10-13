import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AllExceptionsFilter } from "../common/all-exceptions.filter.js";
import { ConfigModule } from "../config/config.module.js";
import { StorageModule } from "./storage.module.js";
import { StorageService } from "./storage.service.js";

// Ходят в локальный MinIO (npm run db:up): проверяется настоящий S3-обмен
// и раздача /media/* поверх него. Свои объекты тест кладёт под test/ и
// убирает за собой.
//
// Модуль auth не подключается: без него @AllowAnonymous() — просто
// метаданные, а глобального guard'а нет. Глобального префикса здесь тоже
// нет, и его exclude для /media не проверяется — маршрут и так без /api.

describe("Хранилище", () => {
  let app: INestApplication<Server>;
  let storage: StorageService;
  const keys: string[] = [];

  const newKey = () => {
    const key = `test/${randomUUID()}.txt`;
    keys.push(key);
    return key;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, StorageModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    storage = app.get(StorageService);
  });

  afterAll(async () => {
    await Promise.all(keys.map((key) => storage.delete(key)));
    await app.close();
  });

  it("put → GET /media/<key> → delete → 404", async () => {
    const key = newKey();
    const body = Buffer.from("привет, MinIO");
    await storage.put(key, body, "text/plain; charset=utf-8");

    const response = await request(app.getHttpServer()).get(`/media/${key}`).expect(200);
    expect(response.text).toBe("привет, MinIO");
    expect(response.headers["content-type"]).toBe("text/plain; charset=utf-8");
    expect(response.headers["content-length"]).toBe(String(body.length));
    expect(response.headers["etag"]).toMatch(/^".+"$/);
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");

    await storage.delete(key);
    const missing = await request(app.getHttpServer()).get(`/media/${key}`).expect(404);
    expect(missing.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    // 404 не кешируется навсегда: файл по ключу ещё может появиться
    expect(missing.headers["cache-control"] ?? "").not.toContain("immutable");
  });

  it.each(["/media/..%2Fx", "/media/Test/X.txt", "/media/test//x.txt"])(
    "невалидный ключ %s — 404",
    async (path) => {
      const response = await request(app.getHttpServer()).get(path).expect(404);
      expect(response.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    },
  );

  it("get отсутствующего — undefined, delete — без ошибки", async () => {
    const key = newKey();
    await expect(storage.get(key)).resolves.toBeUndefined();
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });
});
