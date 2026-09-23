import type { Server } from "node:http";
import { Test, type TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { SQL, type Sql } from "../src/db/db.module.js";

/**
 * UC-U2 целиком по HTTP: контактные данные и пароль меняются маршрутами
 * Better Auth, своих контроллеров у них нет — проверить это можно только
 * приложением. Заодно проверяется валидация схемами контракта: она висит
 * before-хуком Better Auth (apps/api/src/auth/auth.ts), не пайпом Nest.
 *
 * Свои данные (email начинаются с e2e-account-) тест убирает.
 */

const PASSWORD = "SuperSecret123!";
const NEW_PASSWORD = "BrandNewPass456!";
const email = "e2e-account-client@example.com";

describe("Контактные данные и пароль (e2e)", () => {
  let app: INestApplication<Server>;
  let sql: Sql;
  let http: Server;
  let cookie: string;

  const signIn = (password: string) =>
    request(http).post("/api/auth/sign-in/email").send({ email, password });

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix("api");
    await app.init();

    http = app.getHttpServer();
    sql = app.get<Sql>(SQL);

    await sql`delete from users where email like 'e2e-account-%'`;

    const signUp = await request(http)
      .post("/api/auth/sign-up/email")
      .send({ email, password: PASSWORD, name: "Тест Клиент", phone: "+79990000041" })
      .expect(200);

    cookie = (signUp.headers["set-cookie"] as unknown as string[]).join("; ");
  });

  afterAll(async () => {
    await sql`delete from users where email like 'e2e-account-%'`;
    await app.close();
  });

  it("меняет имя и телефон — новое значение видно и в сессии, и в users", async () => {
    await request(http)
      .post("/api/auth/update-user")
      .set("Cookie", cookie)
      .send({ name: "Пётр Клиентов", phone: "+79990000042" })
      .expect(200);

    const session = await request(http).get("/api/auth/get-session").set("Cookie", cookie);

    expect(session.body.user).toMatchObject({
      name: "Пётр Клиентов",
      phone: "+79990000042",
    });

    // phone — additionalFields Better Auth; убеждаемся, что он доехал до колонки
    const [row] = await sql<{ name: string; phone: string }[]>`
      select name, phone from users where email = ${email}
    `;
    expect(row).toEqual({ name: "Пётр Клиентов", phone: "+79990000042" });
  });

  it("не принимает телефон не в формате РФ", async () => {
    const response = await request(http)
      .post("/api/auth/update-user")
      .set("Cookie", cookie)
      .send({ phone: "88005553535" })
      .expect(400);

    expect(response.body.code).toBe("VALIDATION_FAILED");
  });

  it("меняет пароль: старый больше не подходит, новый подходит", async () => {
    await request(http)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(200);

    await signIn(PASSWORD).expect(401);
    await signIn(NEW_PASSWORD).expect(200);
  });

  it("не регистрирует с телефоном не в формате РФ", async () => {
    const response = await request(http)
      .post("/api/auth/sign-up/email")
      .send({
        email: "e2e-account-bad@example.com",
        password: PASSWORD,
        name: "Кривой Телефон",
        phone: "12345",
      })
      .expect(400);

    expect(response.body.code).toBe("VALIDATION_FAILED");
  });

  it("приводит email к нижнему регистру — иначе не проходит CHECK users_email_ck", async () => {
    await request(http)
      .post("/api/auth/sign-up/email")
      .send({
        email: "E2E-Account-Case@Example.com",
        password: PASSWORD,
        name: "  Регистр  ",
        phone: "+79990000043",
      })
      .expect(200);

    const [row] = await sql<{ name: string }[]>`
      select name from users where email = 'e2e-account-case@example.com'
    `;
    expect(row?.name).toBe("Регистр");
  });
});
