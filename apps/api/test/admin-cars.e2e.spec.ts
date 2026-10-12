import type { Server } from "node:http";
import { RequestMethod, type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { apiErrorSchema } from "@carshowroom/contracts";
import { AppModule } from "../src/app.module.js";
import { SQL, type Sql } from "../src/db/db.module.js";
import { MEDIA_ROUTE } from "../src/storage/media.controller.js";

/**
 * Карточки автомобилей в админке (UC-A3, UC-A4) по HTTP: доступ по ролям
 * через реальные guard-ы Better Auth, коды ответов, разбор :id и то, что
 * черновик не виден в публичном каталоге. Логику сервиса подробно
 * проверяет src/admin-cars/admin-cars.spec.ts.
 *
 * Свои данные (email и slug начинаются с e2e-acars-) тест убирает.
 * Фото вставляются SQL-ом с путём /assets/..., чтобы не трогать MinIO.
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
});
