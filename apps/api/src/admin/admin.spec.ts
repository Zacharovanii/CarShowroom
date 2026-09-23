import { Test, type TestingModule } from "@nestjs/testing";
import { USERS_PAGE_SIZE, usersResponseSchema } from "@carshowroom/contracts";
import { ConfigModule } from "../config/config.module.js";
import { DatabaseModule, SQL, type Sql } from "../db/db.module.js";
import { authPool } from "../auth/auth.js";
import { AdminModule } from "./admin.module.js";
import { AdminService } from "./admin.service.js";

// Ходят в локальную базу: проверяется и SQL списка, и то, что Better Auth
// действительно заводит пользователя вместе с паролем. Свои данные тест
// убирает за собой — все email начинаются с spec-adm-.
//
// Роль проверяет guard на контроллере, здесь её нет: доступ по ролям —
// apps/api/test/staff.e2e.spec.ts.

describe("Админ", () => {
  let moduleRef: TestingModule;
  let admin: AdminService;
  let sql: Sql;

  const emailPrefix = "spec-adm-";
  const managerEmail = `${emailPrefix}new-manager@example.com`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, AdminModule],
    }).compile();

    await moduleRef.init();
    admin = moduleRef.get(AdminService);
    sql = moduleRef.get<Sql>(SQL);
  });

  afterEach(async () => {
    await sql`delete from users where email like ${emailPrefix + "%"}`;
  });

  afterAll(async () => {
    await moduleRef.close();
    // модуль auth сюда не подключён, поэтому его пул закрывает сам тест
    await authPool.end();
  });

  describe("POST /api/admin/users", () => {
    it("заводит менеджера вместе с паролем — сотрудник сможет войти", async () => {
      const created = await admin.createManager({
        name: "Новый Менеджер",
        email: managerEmail,
        phone: "+79990000021",
        password: "SuperSecret123!",
      });

      expect(created).toMatchObject({
        name: "Новый Менеджер",
        email: managerEmail,
        phone: "+79990000021",
        role: "manager",
      });

      // без строки в accounts с хешем пароля вход невозможен — ради неё
      // пользователь и заводится через Better Auth, а не insert-ом
      const [account] = await sql<{ providerId: string; password: string | null }[]>`
        select a.provider_id, a.password
        from accounts a
        join users u on u.id = a.user_id
        where u.email = ${managerEmail}`;
      expect(account?.providerId).toBe("credential");
      expect(account?.password).toBeTruthy();
    });

    it("занятый email — EMAIL_TAKEN", async () => {
      const input = {
        name: "Новый Менеджер",
        email: managerEmail,
        phone: "+79990000021",
        password: "SuperSecret123!",
      };
      await admin.createManager(input);

      await expect(admin.createManager(input)).rejects.toMatchObject({
        code: "EMAIL_TAKEN",
        status: 409,
      });
    });
  });

  describe("GET /api/admin/users", () => {
    // страница больше 20 нужна, чтобы проверить саму пагинацию
    const total = USERS_PAGE_SIZE + 5;

    beforeEach(async () => {
      await sql`
        insert into users (name, email, phone, role)
        select 'Спек Пользователь ' || n,
               ${emailPrefix} || 'list-' || n || '@example.com',
               '+7999' || lpad(n::text, 7, '0'),
               case when n = 1 then 'manager' else 'user' end
        from generate_series(1, ${total}) as n`;
    });

    it("ответ соответствует контракту и режется на страницы", async () => {
      const first = await admin.getUsers({ q: "Спек Пользователь", page: 1 });

      expect(usersResponseSchema.parse(first)).toEqual(first);
      expect(first).toMatchObject({
        page: 1,
        pageSize: USERS_PAGE_SIZE,
        total,
        totalPages: 2,
      });
      expect(first.items).toHaveLength(USERS_PAGE_SIZE);

      const second = await admin.getUsers({ q: "Спек Пользователь", page: 2 });
      expect(second.items).toHaveLength(total - USERS_PAGE_SIZE);

      // страницы не пересекаются
      const ids = new Set([...first.items, ...second.items].map((user) => user.id));
      expect(ids.size).toBe(total);
    });

    it("ищет и по имени, и по email", async () => {
      const byName = await admin.getUsers({ q: "Спек Пользователь 7", page: 1 });
      expect(byName.items.map((user) => user.email)).toEqual([`${emailPrefix}list-7@example.com`]);

      const byEmail = await admin.getUsers({ q: `${emailPrefix}list-7@`, page: 1 });
      expect(byEmail.items.map((user) => user.name)).toEqual(["Спек Пользователь 7"]);
    });

    it("фильтрует по роли", async () => {
      const managers = await admin.getUsers({ q: "Спек Пользователь", role: "manager", page: 1 });

      expect(managers.total).toBe(1);
      expect(managers.items[0]).toMatchObject({ name: "Спек Пользователь 1", role: "manager" });
    });
  });
});
