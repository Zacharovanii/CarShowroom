import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { join } from "node:path";
import { RequestMethod, type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import {
  adminCarSchema,
  apiErrorSchema,
  carDetailsSchema,
  carsResponseSchema,
} from "@carshowroom/contracts";
import { AdminCarsService } from "../src/admin-cars/admin-cars.service.js";
import { IMAGE_MAX_BYTES } from "../src/admin-cars/file-checks.js";
import { AppModule } from "../src/app.module.js";
import { SQL, type Sql } from "../src/db/db.module.js";
import { MEDIA_ROUTE } from "../src/storage/media.controller.js";

/**
 * Карточки автомобилей в админке (UC-A3, UC-A4) по HTTP: доступ по ролям
 * через реальные guard-ы Better Auth, коды ответов, разбор :id и то, что
 * черновик не виден в публичном каталоге. Логику сервиса подробно
 * проверяет src/admin-cars/admin-cars.spec.ts.
 *
 * Фото и модель (UC-A5, UC-A6) по HTTP: multipart, лимиты multer, раздача
 * загруженного через /media и то, что модель видна в публичном каталоге.
 * Подробно файлы проверяет src/admin-cars/admin-cars-files.spec.ts.
 *
 * Свои данные (email и slug начинаются с e2e-acars-) тест убирает, включая
 * объекты MinIO: их ключи берутся из путей /media/... в БД перед удалением
 * машин. Там, где файл не важен, фото вставляется SQL-ом с путём /assets/...
 */

const PASSWORD = "SuperSecret123!";
const adminEmail = "e2e-acars-admin@example.com";
const clientEmail = "e2e-acars-client@example.com";

describe("Админ: карточки автомобилей (e2e)", () => {
  let app: INestApplication<Server>;
  let sql: Sql;
  let http: Server;

  let adminCookie: string;
  let clientCookie: string;
  let clientId: string;
  let body: Record<string, unknown>;
  let colors: number[];

  const signIn = async (email: string): Promise<string> => {
    const response = await request(http)
      .post("/api/auth/sign-in/email")
      .send({ email, password: PASSWORD })
      .expect(200);

    return (response.headers["set-cookie"] as unknown as string[]).join("; ");
  };

  /** Новый черновик админом; name и slug уникальны в пределах прогона. */
  let counter = 0;
  const createCar = async (overrides: Record<string, unknown> = {}) => {
    counter += 1;
    const response = await request(http)
      .post("/api/admin/cars")
      .set("Cookie", adminCookie)
      .send({
        ...body,
        name: `E2E ACars ${counter}`,
        slug: `e2e-acars-${counter}`,
        ...overrides,
      })
      .expect(201);
    return response.body as { id: number; slug: string; name: string; isPublished: boolean };
  };

  const expectError = (response: request.Response, code: string) => {
    expect(apiErrorSchema.parse(response.body).error.code).toBe(code);
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // те же настройки, что в main.ts
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix("api", { exclude: [{ path: MEDIA_ROUTE, method: RequestMethod.GET }] });
    await app.init();

    http = app.getHttpServer();
    sql = app.get<Sql>(SQL);

    const { auth } = await import("../src/auth/auth.js");
    await auth.api.createUser({
      body: {
        email: adminEmail,
        password: PASSWORD,
        name: "Тест Админ",
        role: "admin",
        data: { phone: "+79990000041" },
      },
    });

    await request(http)
      .post("/api/auth/sign-up/email")
      .send({ email: clientEmail, password: PASSWORD, name: "Тест Клиент", phone: "+79990000042" })
      .expect(200);

    adminCookie = await signIn(adminEmail);
    clientCookie = await signIn(clientEmail);

    const [client] = await sql<{ id: string }[]>`select id from users where email = ${clientEmail}`;
    clientId = client!.id;

    const options = await request(http)
      .get("/api/admin/cars/options")
      .set("Cookie", adminCookie)
      .expect(200);
    colors = (options.body.colors as { id: number }[]).slice(0, 2).map((color) => color.id);

    body = {
      seriesId: options.body.series[0].id,
      bodyTypeId: options.body.bodyTypes[0].id,
      fuelTypeId: options.body.fuelTypes[0].id,
      driveType: "rwd",
      modelYear: 2026,
      description: "Автомобиль из e2e-теста",
      powerHp: 250,
      accelerationS: "5.8",
      topSpeedKmh: 240,
      price: "4100000.00",
      colorIds: [colors[0]],
    };
  });

  afterAll(async () => {
    // объекты MinIO — до удаления строк, пока пути ещё есть в БД
    const media = await sql<{ path: string }[]>`
      select i.path from car_images i join cars c on c.id = i.car_id
      where c.slug like 'e2e-acars-%'
      union all
      select model_3d_path from cars
      where slug like 'e2e-acars-%' and model_3d_path is not null`;
    await app.get(AdminCarsService).deleteMediaObjects(media.map((row) => row.path));

    await sql`
      delete from test_drives
      where car_id in (select id from cars where slug like 'e2e-acars-%')
         or user_id in (select id from users where email like 'e2e-acars-%')`;
    await sql`delete from cars where slug like 'e2e-acars-%'`;
    await sql`delete from users where email like 'e2e-acars-%'`;
    await app.close();
  });

  it("гость — 401, клиент — 403", async () => {
    const calls = [
      () => request(http).get("/api/admin/cars"),
      () => request(http).get("/api/admin/cars/options"),
      () => request(http).post("/api/admin/cars").send({}),
      () => request(http).delete("/api/admin/cars/1"),
    ];

    for (const call of calls) {
      expectError(await call().expect(401), "FORBIDDEN");
      expectError(await call().set("Cookie", clientCookie).expect(403), "FORBIDDEN");
    }
  });

  it("options не уходит в :id; невалидный id — 400, несуществующий — 404", async () => {
    const options = await request(http)
      .get("/api/admin/cars/options")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(options.body.series.length).toBeGreaterThan(0);

    expectError(
      await request(http).get("/api/admin/cars/abc").set("Cookie", adminCookie).expect(400),
      "VALIDATION_FAILED",
    );
    expectError(
      await request(http).get("/api/admin/cars/999999999").set("Cookie", adminCookie).expect(404),
      "NOT_FOUND",
    );
  });

  it("невалидное тело POST и пустой PATCH — 400 VALIDATION_FAILED", async () => {
    expectError(
      await request(http).post("/api/admin/cars").set("Cookie", adminCookie).send({}).expect(400),
      "VALIDATION_FAILED",
    );
    expectError(
      await request(http)
        .post("/api/admin/cars")
        .set("Cookie", adminCookie)
        .send({ ...body, name: "E2E ACars bad", slug: "Не Slug", price: "-1" })
        .expect(400),
      "VALIDATION_FAILED",
    );

    const car = await createCar();
    expectError(
      await request(http)
        .patch(`/api/admin/cars/${car.id}`)
        .set("Cookie", adminCookie)
        .send({})
        .expect(400),
      "VALIDATION_FAILED",
    );
  });

  it("POST — 201 черновик, публично его не видно; PATCH заменяет палитру", async () => {
    const car = await createCar();
    expect(car.isPublished).toBe(false);

    const list = await request(http)
      .get(`/api/cars?q=${encodeURIComponent(car.name)}`)
      .expect(200);
    expect(list.body.items).toEqual([]);
    expectError(await request(http).get(`/api/cars/${car.slug}`).expect(404), "NOT_FOUND");

    const updated = await request(http)
      .patch(`/api/admin/cars/${car.id}`)
      .set("Cookie", adminCookie)
      .send({ colorIds: [colors[1]], price: "3999999.99" })
      .expect(200);
    expect(updated.body).toMatchObject({ colorIds: [colors[1]], price: "3999999.99" });

    // в админском списке черновик есть
    const admin = await request(http)
      .get(`/api/admin/cars?q=${car.slug}&status=draft`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(admin.body.items.map((item: { id: number }) => item.id)).toEqual([car.id]);
  });

  it("занятый slug — 409 SLUG_TAKEN", async () => {
    const [seed] = await sql<{ slug: string }[]>`
      select slug from catalog_items order by id limit 1`;

    const response = await request(http)
      .post("/api/admin/cars")
      .set("Cookie", adminCookie)
      .send({ ...body, name: "E2E ACars taken", slug: seed!.slug })
      .expect(409);
    expectError(response, "SLUG_TAKEN");
    expect(response.body.error.details).toMatchObject({ field: "slug" });
  });

  it("публикация: без фото 409, с фото — в каталоге; снятие убирает из каталога", async () => {
    const car = await createCar();
    const publish = () =>
      request(http).post(`/api/admin/cars/${car.id}/publish`).set("Cookie", adminCookie);
    const unpublish = () =>
      request(http).post(`/api/admin/cars/${car.id}/unpublish`).set("Cookie", adminCookie);

    expectError(await publish().expect(409), "CAR_NOT_READY");

    await sql`
      insert into car_images (car_id, position, path, alt)
      values (${car.id}, 1, ${`/assets/e2e-acars/${car.slug}-1.webp`}, 'Фото')`;

    expect((await publish().expect(200)).body.isPublished).toBe(true);
    expect((await publish().expect(200)).body.isPublished).toBe(true);
    const visible = await request(http).get(`/api/cars/${car.slug}`).expect(200);
    expect(visible.body.id).toBe(car.id);

    expect((await unpublish().expect(200)).body.isPublished).toBe(false);
    expect((await unpublish().expect(200)).body.isPublished).toBe(false);
    await request(http).get(`/api/cars/${car.slug}`).expect(404);
  });

  it("DELETE: без записей — 204, повтор — 404; с записью — 409, автомобиль на месте", async () => {
    const free = await createCar();
    const deleted = await request(http)
      .delete(`/api/admin/cars/${free.id}`)
      .set("Cookie", adminCookie)
      .expect(204);
    expect(deleted.text).toBe("");
    expectError(
      await request(http)
        .delete(`/api/admin/cars/${free.id}`)
        .set("Cookie", adminCookie)
        .expect(404),
      "NOT_FOUND",
    );

    const busy = await createCar();
    await sql`
      insert into test_drives (user_id, car_id, starts_at, phone)
      values (${clientId}, ${busy.id}, date_trunc('hour', now()) - interval '4 days', '+79990000042')`;

    expectError(
      await request(http)
        .delete(`/api/admin/cars/${busy.id}`)
        .set("Cookie", adminCookie)
        .expect(409),
      "CAR_HAS_TEST_DRIVES",
    );
    const still = await request(http)
      .get(`/api/admin/cars/${busy.id}`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(still.body.testDrivesCount).toBe(1);
  });

  describe("фото и модель", () => {
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
    const placeholderGlb = readFileSync(
      join(import.meta.dirname, "../public/assets/placeholder-car.glb"),
    );

    const uploadImage = (carId: number, file: Buffer = PNG, alt = "Фото") =>
      request(http)
        .post(`/api/admin/cars/${carId}/images`)
        .set("Cookie", adminCookie)
        .attach("file", file, "photo.png")
        .field("alt", alt);

    const uploadModel = (carId: number, fields: Record<string, string> = {}) => {
      const call = request(http)
        .put(`/api/admin/cars/${carId}/model`)
        .set("Cookie", adminCookie)
        .attach("file", placeholderGlb, "car.glb");
      for (const [name, value] of Object.entries(fields)) void call.field(name, value);
      return call;
    };

    it("клиент — 403 на загрузку фото и модели", async () => {
      const car = await createCar();

      expectError(
        await request(http)
          .post(`/api/admin/cars/${car.id}/images`)
          .set("Cookie", clientCookie)
          .attach("file", PNG, "photo.png")
          .field("alt", "Фото")
          .expect(403),
        "FORBIDDEN",
      );
      expectError(
        await request(http)
          .put(`/api/admin/cars/${car.id}/model`)
          .set("Cookie", clientCookie)
          .attach("file", placeholderGlb, "car.glb")
          .expect(403),
        "FORBIDDEN",
      );
    });

    it("POST images — 201 карточка по контракту, файл раздаётся через /media", async () => {
      const car = await createCar();

      const response = await uploadImage(car.id, PNG, "Спереди").expect(201);
      const card = adminCarSchema.parse(response.body);
      expect(card.images).toEqual([
        {
          id: expect.any(Number),
          position: 1,
          path: expect.stringMatching(new RegExp(`^/media/cars/${car.id}/[0-9a-f-]{36}\\.png$`)),
          alt: "Спереди",
        },
      ]);

      const media = await request(http).get(card.images[0]!.path).expect(200);
      expect(media.headers["content-type"]).toBe("image/png");
      expect(Buffer.compare(media.body as Buffer, PNG)).toBe(0);
    });

    it("ошибки загрузки: сигнатура, нет файла, лишнее поле-файл, пустой alt, размер", async () => {
      const car = await createCar();

      expectError(
        await uploadImage(car.id, Buffer.from("GIF89a\x01\x00\x01\x00", "latin1")).expect(400),
        "INVALID_FILE",
      );

      const noFile = await request(http)
        .post(`/api/admin/cars/${car.id}/images`)
        .set("Cookie", adminCookie)
        .field("alt", "Фото")
        .expect(400);
      expectError(noFile, "VALIDATION_FAILED");
      expect(noFile.body.error.details).toMatchObject({ field: "file" });

      const extraFile = await uploadImage(car.id).attach("other", PNG, "other.png").expect(400);
      expectError(extraFile, "VALIDATION_FAILED");
      expect(extraFile.body.error.details).toMatchObject({ field: "other" });

      expectError(await uploadImage(car.id, PNG, "  ").expect(400), "VALIDATION_FAILED");

      const big = Buffer.alloc(IMAGE_MAX_BYTES + 1);
      PNG.copy(big);
      expectError(await uploadImage(car.id, big).expect(413), "FILE_TOO_LARGE");

      expectError(await uploadImage(999_999_999).expect(404), "NOT_FOUND");

      // ни одна неудачная попытка не оставила фото
      const card = await request(http)
        .get(`/api/admin/cars/${car.id}`)
        .set("Cookie", adminCookie)
        .expect(200);
      expect(card.body.images).toEqual([]);
    });

    it("alt, порядок, замена файла, удаление; LAST_IMAGE у опубликованного", async () => {
      const car = await createCar();
      await uploadImage(car.id, PNG, "a").expect(201);
      const uploaded = adminCarSchema.parse((await uploadImage(car.id, PNG, "b").expect(201)).body);
      const [a, b] = uploaded.images;
      const images = `/api/admin/cars/${car.id}/images`;

      const alt = await request(http)
        .patch(`${images}/${a!.id}`)
        .set("Cookie", adminCookie)
        .send({ alt: "Новое описание" })
        .expect(200);
      expect(alt.body.images[0]).toMatchObject({ id: a!.id, alt: "Новое описание" });

      const order = await request(http)
        .put(`${images}/order`)
        .set("Cookie", adminCookie)
        .send({ imageIds: [b!.id, a!.id] })
        .expect(200);
      expect(order.body.images.map((image: { id: number }) => image.id)).toEqual([b!.id, a!.id]);

      const mismatch = await request(http)
        .put(`${images}/order`)
        .set("Cookie", adminCookie)
        .send({ imageIds: [b!.id] })
        .expect(400);
      expectError(mismatch, "VALIDATION_FAILED");
      expect(mismatch.body.error.details).toMatchObject({ field: "imageIds" });

      const replaced = await request(http)
        .put(`${images}/${a!.id}/file`)
        .set("Cookie", adminCookie)
        .attach("file", PNG, "photo.png")
        .expect(200);
      expect(replaced.body.images[1]).toMatchObject({ id: a!.id, position: 2 });
      expect(replaced.body.images[1].path).not.toBe(a!.path);
      expectError(await request(http).get(a!.path).expect(404), "NOT_FOUND");

      expectError(
        await request(http).delete(`${images}/999999999`).set("Cookie", adminCookie).expect(404),
        "NOT_FOUND",
      );

      const deleted = await request(http)
        .delete(`${images}/${b!.id}`)
        .set("Cookie", adminCookie)
        .expect(200);
      expect(deleted.body.images).toEqual([
        { id: a!.id, position: 1, path: replaced.body.images[1].path, alt: "Новое описание" },
      ]);

      await request(http)
        .post(`/api/admin/cars/${car.id}/publish`)
        .set("Cookie", adminCookie)
        .expect(200);
      expectError(
        await request(http).delete(`${images}/${a!.id}`).set("Cookie", adminCookie).expect(409),
        "LAST_IMAGE",
      );
    });

    it("модель: CarPaint по умолчанию, неверный материал, публичный каталог, DELETE", async () => {
      const car = await createCar();
      await uploadImage(car.id).expect(201);
      await request(http)
        .post(`/api/admin/cars/${car.id}/publish`)
        .set("Cookie", adminCookie)
        .expect(200);

      const wrong = await uploadModel(car.id, { paintMaterial: "НетТакого" }).expect(400);
      expectError(wrong, "PAINT_MATERIAL_NOT_FOUND");
      expect(wrong.body.error.details.materials).toEqual(expect.arrayContaining(["CarPaint"]));

      expectError(
        await request(http)
          .put(`/api/admin/cars/${car.id}/model`)
          .set("Cookie", adminCookie)
          .attach("file", PNG, "car.glb")
          .expect(400),
        "INVALID_FILE",
      );

      const set = await uploadModel(car.id).expect(200);
      const model = adminCarSchema.parse(set.body).model;
      expect(model).toEqual({
        path: expect.stringMatching(new RegExp(`^/media/models/${car.id}/[0-9a-f-]{36}\\.glb$`)),
        paintMaterial: "CarPaint",
      });

      const media = await request(http).get(model!.path).expect(200);
      expect(media.headers["content-type"]).toBe("model/gltf-binary");

      const details = carDetailsSchema.parse(
        (await request(http).get(`/api/cars/${car.slug}`).expect(200)).body,
      );
      expect(details.model3dPath).toBe(model!.path);

      const list = carsResponseSchema.parse(
        (
          await request(http)
            .get(`/api/cars?q=${encodeURIComponent(car.name)}`)
            .expect(200)
        ).body,
      );
      expect(list.items.map((item) => [item.id, item.has3d])).toEqual([[car.id, true]]);

      const removed = await request(http)
        .delete(`/api/admin/cars/${car.id}/model`)
        .set("Cookie", adminCookie)
        .expect(200);
      expect(removed.body.model).toBeNull();
      await request(http).get(model!.path).expect(404);
      // повтор — то же 200
      await request(http)
        .delete(`/api/admin/cars/${car.id}/model`)
        .set("Cookie", adminCookie)
        .expect(200);
    });

    describe("сквозной сценарий", () => {
      it("черновик → фото → публикация → модель → замена фото → снятие → удаление", async () => {
        const inList = async (name: string) =>
          carsResponseSchema
            .parse(
              (
                await request(http)
                  .get(`/api/cars?q=${encodeURIComponent(name)}`)
                  .expect(200)
              ).body,
            )
            .items.map((item) => [item.id, item.has3d]);

        const car = await createCar();
        expect(car.isPublished).toBe(false);

        const photo = adminCarSchema.parse((await uploadImage(car.id).expect(201)).body).images[0]!;
        await request(http).get(photo.path).expect(200);

        await request(http)
          .post(`/api/admin/cars/${car.id}/publish`)
          .set("Cookie", adminCookie)
          .expect(200);
        expect(await inList(car.name)).toEqual([[car.id, false]]);
        const published = carDetailsSchema.parse(
          (await request(http).get(`/api/cars/${car.slug}`).expect(200)).body,
        );
        expect(published.model3dPath).toBeNull();

        const model = adminCarSchema.parse((await uploadModel(car.id).expect(200)).body).model!;
        expect(await inList(car.name)).toEqual([[car.id, true]]);
        const with3d = carDetailsSchema.parse(
          (await request(http).get(`/api/cars/${car.slug}`).expect(200)).body,
        );
        expect(with3d.model3dPath).toBe(model.path);

        const replaced = adminCarSchema.parse(
          (
            await request(http)
              .put(`/api/admin/cars/${car.id}/images/${photo.id}/file`)
              .set("Cookie", adminCookie)
              .attach("file", PNG, "photo.png")
              .expect(200)
          ).body,
        ).images[0]!;
        expect(replaced).toMatchObject({ id: photo.id, position: 1 });
        expect(replaced.path).not.toBe(photo.path);
        expectError(await request(http).get(photo.path).expect(404), "NOT_FOUND");
        await request(http).get(replaced.path).expect(200);

        await request(http)
          .post(`/api/admin/cars/${car.id}/unpublish`)
          .set("Cookie", adminCookie)
          .expect(200);
        expectError(await request(http).get(`/api/cars/${car.slug}`).expect(404), "NOT_FOUND");
        expect(await inList(car.name)).toEqual([]);

        await request(http)
          .delete(`/api/admin/cars/${car.id}`)
          .set("Cookie", adminCookie)
          .expect(204);
        await request(http).get(`/api/admin/cars/${car.id}`).set("Cookie", adminCookie).expect(404);
        // объекты MinIO удалены вместе с автомобилем
        await request(http).get(replaced.path).expect(404);
        await request(http).get(model.path).expect(404);
      });
    });
  });
});
