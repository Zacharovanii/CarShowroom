import type { Server } from "node:http";
import { Test, type TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { SQL, type Sql } from "../src/db/db.module.js";
import { salonDay, slotInstant } from "../src/test-drives/rules.js";
import { signUpVerified } from "./helpers.js";

/**
 * Доступ к экранам сотрудников — по HTTP, через реальные guard-ы
 * Better Auth: роль проверяется на эндпоинте, а не в сервисе, поэтому
 * такую проверку видно только целым приложением.
 *
 * Сценарий целиком: админ заводит менеджера → менеджер входит → работает
 * с записями дня. Свои данные (email начинаются с e2e-staff-) тест убирает.
 */

const PASSWORD = "SuperSecret123!";
const adminEmail = "e2e-staff-admin@example.com";
const clientEmail = "e2e-staff-client@example.com";
const managerEmail = "e2e-staff-manager@example.com";

describe("Экраны сотрудников (e2e)", () => {
  let app: INestApplication<Server>;
  let sql: Sql;
  let http: Server;

  let adminCookie: string;
  let clientCookie: string;
  let managerCookie: string;
  let testDriveId: number;

  const pastDay = salonDay(new Date(Date.now() - 5 * 24 * 3_600_000));

  /** Вход и cookie сессии: остальные запросы идут с ней. */
  const signIn = async (email: string): Promise<string> => {
    const response = await request(http)
      .post("/api/auth/sign-in/email")
      .send({ email, password: PASSWORD })
      .expect(200);

    return (response.headers["set-cookie"] as unknown as string[]).join("; ");
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // те же настройки, что в main.ts: Better Auth сам парсит body своих
    // маршрутов, а /api вешается глобальным префиксом
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix("api");
    await app.init();

    http = app.getHttpServer();
    sql = app.get<Sql>(SQL);

    // админ заводится в обход API — через интерфейс роль admin
    // не назначается (UC-A2), в проекте это делает seed-скрипт
    const { auth } = await import("../src/auth/auth.js");
    await auth.api.createUser({
      body: {
        email: adminEmail,
        password: PASSWORD,
        name: "Тест Админ",
        role: "admin",
        data: { phone: "+79990000031", emailVerified: true },
      },
    });

    await signUpVerified(http, sql, {
      email: clientEmail,
      password: PASSWORD,
      name: "Тест Клиент",
      phone: "+79990000032",
    });

    adminCookie = await signIn(adminEmail);
    clientCookie = await signIn(clientEmail);

    const [client] = await sql<{ id: string }[]>`select id from users where email = ${clientEmail}`;
    const [car] = await sql<
      { id: number }[]
    >`select id::int as id from catalog_items order by id limit 1`;

    // запись в прошлом: её менеджер и будет закрывать
    const [row] = await sql<{ id: number }[]>`
      insert into test_drives (user_id, car_id, starts_at, phone)
      values (${client!.id}, ${car!.id}, ${slotInstant(pastDay, 12)}, '+79990000032')
      returning id::int as id`;
    testDriveId = row!.id;
  });

  afterAll(async () => {
    await sql`delete from test_drives where id = ${testDriveId}`;
    await sql`delete from users where email like 'e2e-staff-%'`;
    await app.close();
  });

  it("гость — 401, клиент — 403", async () => {
    await request(http).get(`/api/manager/test-drives?date=${pastDay}`).expect(401);
    await request(http)
      .get(`/api/manager/test-drives?date=${pastDay}`)
      .set("Cookie", clientCookie)
      .expect(403);

    await request(http)
      .patch(`/api/manager/test-drives/${testDriveId}`)
      .set("Cookie", clientCookie)
      .send({ status: "completed" })
      .expect(403);

    await request(http).get("/api/admin/users").expect(401);
    await request(http).get("/api/admin/users").set("Cookie", clientCookie).expect(403);
  });

  it("менеджера создаёт только админ", async () => {
    await request(http)
      .post("/api/admin/users")
      .set("Cookie", clientCookie)
      .send({
        name: "Чужой",
        email: "e2e-staff-nope@example.com",
        phone: "+79990000039",
        password: PASSWORD,
      })
      .expect(403);

    const created = await request(http)
      .post("/api/admin/users")
      .set("Cookie", adminCookie)
      .send({
        name: "Тест Менеджер",
        email: managerEmail,
        phone: "+79990000033",
        password: PASSWORD,
      })
      .expect(201);

    expect(created.body).toMatchObject({ email: managerEmail, role: "manager" });
  });

  it("созданный менеджер входит и видит записи дня с данными клиента", async () => {
    managerCookie = await signIn(managerEmail);

    const day = await request(http)
      .get(`/api/manager/test-drives?date=${pastDay}`)
      .set("Cookie", managerCookie)
      .expect(200);

    const item = (day.body.items as { id: number; client: { email: string } }[]).find(
      (row) => row.id === testDriveId,
    );
    expect(item?.client.email).toBe(clientEmail);
  });

  it("менеджер закрывает запись, повторная попытка — 409 ALREADY_CLOSED", async () => {
    const closed = await request(http)
      .patch(`/api/manager/test-drives/${testDriveId}`)
      .set("Cookie", managerCookie)
      .send({ status: "completed" })
      .expect(200);

    expect(closed.body).toMatchObject({ id: testDriveId, status: "completed" });

    const again = await request(http)
      .patch(`/api/manager/test-drives/${testDriveId}`)
      .set("Cookie", managerCookie)
      .send({ status: "completed" })
      .expect(409);

    expect(again.body.error.code).toBe("ALREADY_CLOSED");
  });

  it("админ проходит и на экран менеджера — права накопительные", async () => {
    await request(http)
      .get(`/api/manager/test-drives?date=${pastDay}`)
      .set("Cookie", adminCookie)
      .expect(200);

    const users = await request(http)
      .get(`/api/admin/users?q=${encodeURIComponent("e2e-staff")}&role=manager`)
      .set("Cookie", adminCookie)
      .expect(200);

    expect(users.body.items.map((user: { email: string }) => user.email)).toEqual([managerEmail]);
  });
});
