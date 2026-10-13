import type { Server } from "node:http";
import request from "supertest";
import type { Sql } from "../src/db/db.module.js";

type SignUpBody = { email: string; password: string; name: string; phone: string };

/**
 * Регистрация через API и сразу подтверждённый email. С requireEmailVerification
 * (D27) вход без подтверждения отвечает 403, а сама регистрация сессию больше
 * не создаёт — поэтому после неё тест входит отдельно. Письмо подтверждения
 * тесты не открывают: email подтверждается SQL-ом, как это сделал бы
 * переход по ссылке.
 */
export async function signUpVerified(http: Server, sql: Sql, body: SignUpBody): Promise<void> {
  await request(http).post("/api/auth/sign-up/email").send(body).expect(200);
  await sql`update users set email_verified = true where email = ${body.email.toLowerCase()}`;
}
