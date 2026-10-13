import type { Server } from "node:http";
import { Test, type TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createEmailVerificationToken } from "better-auth/api";
import { AppModule } from "../src/app.module.js";
import { SQL, type Sql } from "../src/db/db.module.js";
import { clearOutbox, getOutbox, lastMailTo } from "../src/mail/mail.js";
import { signUpVerified } from "./helpers.js";

/**
 * Подтверждение email и сброс пароля (D27) по HTTP: письма не уходят
 * (RESEND_API_KEY в тестах не задан) и ложатся в outbox модуля mail, откуда
 * тест берёт ссылку — как человек взял бы её из почты.
 *
 * Все запросы к Better Auth идут с Origin фронта в dev (docs/architecture.md,
 * «Авторизация»): так их шлёт браузер, и от него же строится ссылка
 * в письме. Этот origin должен быть в WEB_ORIGIN (.env) — иначе Better Auth
 * ответит 403 INVALID_ORIGIN.
 *
 * Свои данные (email начинаются с e2e-verify-) тест убирает: пользователей
 * и строки verifications токенов сброса — у них нет FK на users.
 */

const ORIGIN = "http://127.0.0.1:5173";
const PASSWORD = "SuperSecret123!";
const NEW_PASSWORD = "BrandNewPass456!";

let phoneSeq = 0;
const nextPhone = () => `+7999000${String(7000 + phoneSeq++)}`;

describe("Подтверждение email и сброс пароля (e2e)", () => {
  let app: INestApplication<Server>;
  let sql: Sql;
  let http: Server;

  const post = (path: string) => request(http).post(`/api/auth${path}`).set("Origin", ORIGIN);
  const get = (path: string) => request(http).get(`/api/auth${path}`).set("Origin", ORIGIN);

  const signUp = (email: string) =>
    post("/sign-up/email").send({
      email,
      password: PASSWORD,
      name: "Тест Почта",
      phone: nextPhone(),
    });

  const signIn = (email: string, password: string) =>
    post("/sign-in/email").send({ email, password });

  const cookieOf = (response: request.Response): string =>
    ((response.headers["set-cookie"] as unknown as string[] | undefined) ?? []).join("; ");

  const tokenOf = (url: string): string => new URL(url).searchParams.get("token") ?? "";

  const cleanUp = async () => {
    await sql`
      delete from verifications
      where identifier like 'reset-password:%'
        and value in (select id::text from users where email like 'e2e-verify-%')
    `;
    await sql`delete from users where email like 'e2e-verify-%'`;
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix("api");
    await app.init();

    http = app.getHttpServer();
    sql = app.get<Sql>(SQL);

    await cleanUp();
  });

  beforeEach(() => {
    clearOutbox();
  });

  afterAll(async () => {
    await cleanUp();
    await app.close();
  });

  it("регистрация → письмо → переход по ссылке входит и подтверждает email", async () => {
    const email = "e2e-verify-flow@example.com";

    const signedUp = await signUp(email).expect(200);
    expect(signedUp.body).toMatchObject({ token: null, user: { emailVerified: false } });
    expect(signedUp.headers["set-cookie"]).toBeUndefined();

    const denied = await signIn(email, PASSWORD).expect(403);
    expect(denied.body.code).toBe("EMAIL_NOT_VERIFIED");

    const mail = lastMailTo(email);
    expect(mail?.url.startsWith(`${ORIGIN}/verify-email?token=`)).toBe(true);

    const verified = await get(`/verify-email?token=${tokenOf(mail!.url)}`).expect(200);
    expect(verified.body.status).toBe(true);
    const cookie = cookieOf(verified);
    expect(cookie).toContain("session_token");

    const session = await get("/get-session").set("Cookie", cookie).expect(200);
    expect(session.body.user).toMatchObject({ email, emailVerified: true });

    await signIn(email, PASSWORD).expect(200);

    // повторный переход по той же ссылке — не ошибка, но и не новая сессия
    const again = await get(`/verify-email?token=${tokenOf(mail!.url)}`).expect(200);
    expect(again.headers["set-cookie"]).toBeUndefined();
  });

  it("вход неподтверждённым высылает письмо заново, неверный пароль — нет", async () => {
    const email = "e2e-verify-resend-on-signin@example.com";
    await signUp(email).expect(200);
    clearOutbox();

    await signIn(email, "WrongPassword999!").expect(401);
    expect(getOutbox()).toHaveLength(0);

    await signIn(email, PASSWORD).expect(403);
    expect(getOutbox()).toHaveLength(1);
    expect(lastMailTo(email)?.url.startsWith(`${ORIGIN}/verify-email?token=`)).toBe(true);
  });

  it("verify-email с мусорным токеном → 401 INVALID_TOKEN", async () => {
    const response = await get("/verify-email?token=not-a-jwt").expect(401);
    expect(response.body.code).toBe("INVALID_TOKEN");
  });

  it("verify-email с истёкшим токеном → 401 TOKEN_EXPIRED", async () => {
    const email = "e2e-verify-expired@example.com";
    await signUp(email).expect(200);

    // тот же JWT, что кладёт в письмо Better Auth, только срок вышел минуту назад
    const secret = process.env.BETTER_AUTH_SECRET!;
    const token = await createEmailVerificationToken(secret, email, undefined, -60);

    const response = await get(`/verify-email?token=${token}`).expect(401);
    expect(response.body.code).toBe("TOKEN_EXPIRED");

    const [row] = await sql<{ emailVerified: boolean }[]>`
      select email_verified from users where email = ${email}
    `;
    expect(row?.emailVerified).toBe(false);
  });

  it("«выслать письмо заново»: неподтверждённому — письмо, несуществующему — тот же ответ без письма", async () => {
    const email = "e2e-verify-resend@example.com";
    await signUp(email).expect(200);
    clearOutbox();

    const known = await post("/send-verification-email").send({ email }).expect(200);
    expect(known.body).toEqual({ status: true });
    expect(getOutbox()).toHaveLength(1);
    expect(lastMailTo(email)?.url.startsWith(`${ORIGIN}/verify-email?token=`)).toBe(true);

    clearOutbox();
    const unknown = await post("/send-verification-email")
      .send({ email: "e2e-verify-nobody@example.com" })
      .expect(200);
    expect(unknown.body).toEqual(known.body);
    expect(getOutbox()).toHaveLength(0);
  });

  it("сброс пароля: ссылка на фронт, старые сессии отозваны, токен одноразовый", async () => {
    const email = "e2e-verify-reset@example.com";
    await signUpVerified(http, sql, {
      email,
      password: PASSWORD,
      name: "Тест Сброс",
      phone: nextPhone(),
    });

    const cookies = [
      cookieOf(await signIn(email, PASSWORD).expect(200)),
      cookieOf(await signIn(email, PASSWORD).expect(200)),
    ];
    for (const cookie of cookies) {
      const session = await get("/get-session").set("Cookie", cookie).expect(200);
      expect(session.body.user.email).toBe(email);
    }

    const requested = await post("/request-password-reset").send({ email }).expect(200);
    expect(requested.body.status).toBe(true);

    const mail = lastMailTo(email);
    expect(mail?.url.startsWith(`${ORIGIN}/reset-password?token=`)).toBe(true);
    const token = tokenOf(mail!.url);

    const reset = await post("/reset-password")
      .send({ newPassword: NEW_PASSWORD, token })
      .expect(200);
    expect(reset.body).toEqual({ status: true });

    for (const cookie of cookies) {
      const session = await get("/get-session").set("Cookie", cookie).expect(200);
      expect(session.body).toBeNull();
    }

    await signIn(email, PASSWORD).expect(401);
    await signIn(email, NEW_PASSWORD).expect(200);

    const reused = await post("/reset-password")
      .send({ newPassword: "AnotherPass789!", token })
      .expect(400);
    expect(reused.body.code).toBe("INVALID_TOKEN");
  });

  it("запрос сброса для несуществующего email неотличим от существующего и не шлёт письма", async () => {
    const email = "e2e-verify-reset-known@example.com";
    await signUpVerified(http, sql, {
      email,
      password: PASSWORD,
      name: "Тест Сброс",
      phone: nextPhone(),
    });
    clearOutbox(); // письмо подтверждения после регистрации

    const known = await post("/request-password-reset").send({ email }).expect(200);
    expect(getOutbox()).toHaveLength(1);

    clearOutbox();
    const unknown = await post("/request-password-reset")
      .send({ email: "e2e-verify-reset-nobody@example.com" })
      .expect(200);

    expect(unknown.body).toEqual(known.body);
    expect(getOutbox()).toHaveLength(0);
  });

  it("reset-password с коротким паролем → 400 PASSWORD_TOO_SHORT, токен остаётся годным", async () => {
    const email = "e2e-verify-reset-short@example.com";
    await signUpVerified(http, sql, {
      email,
      password: PASSWORD,
      name: "Тест Сброс",
      phone: nextPhone(),
    });

    await post("/request-password-reset").send({ email }).expect(200);
    const token = tokenOf(lastMailTo(email)!.url);

    const short = await post("/reset-password").send({ newPassword: "short", token }).expect(400);
    expect(short.body.code).toBe("PASSWORD_TOO_SHORT");

    await post("/reset-password").send({ newPassword: NEW_PASSWORD, token }).expect(200);
  });

  it("без доверенного Origin ссылка строится от BETTER_AUTH_URL", async () => {
    const email = "e2e-verify-reset-origin@example.com";
    await signUpVerified(http, sql, {
      email,
      password: PASSWORD,
      name: "Тест Сброс",
      phone: nextPhone(),
    });

    // без Origin вовсе: запрос без cookie Better Auth пропускает
    await request(http).post("/api/auth/request-password-reset").send({ email }).expect(200);
    expect(
      lastMailTo(email)?.url.startsWith(`${process.env.BETTER_AUTH_URL}/reset-password?token=`),
    ).toBe(true);
  });
});
