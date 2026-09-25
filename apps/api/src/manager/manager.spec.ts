import { Test, type TestingModule } from "@nestjs/testing";
import { closeTestDriveSchema, managerTestDrivesSchema } from "@carshowroom/contracts";
import { ConfigModule } from "../config/config.module.js";
import { DatabaseModule, SQL, type Sql } from "../db/db.module.js";
import { salonDay, slotInstant } from "../test-drives/rules.js";
import { ManagerModule } from "./manager.module.js";
import { ManagerService } from "./manager.service.js";

// Как и тесты тест-драйвов, ходят в локальную базу с миграциями и seed-ом:
// проверяется в том числе SQL. Свои данные тест заводит сам и убирает за собой.
//
// Модуль auth не подключается: сервис принимает id сотрудника, а роль
// проверяет guard на контроллере — доступ по ролям проверяет
// apps/api/test/staff.e2e.spec.ts.

describe("Менеджер", () => {
  let moduleRef: TestingModule;
  let manager: ManagerService;
  let sql: Sql;

  let clientId: string;
  let managerId: string;
  let carId: number;
  let otherCarId: number;

  const now = new Date();
  // будущий день — для отмен, прошедший — для результата визита.
  // +12 и −6, а не +10 и −5: test-drives.spec идёт параллельно на той же
  // машине в эти дни, и общие слоты ломали бы тесты друг другу.
  const futureDay = salonDay(new Date(now.getTime() + 12 * 24 * 3_600_000));
  const pastDay = salonDay(new Date(now.getTime() - 6 * 24 * 3_600_000));

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, ManagerModule],
    }).compile();

    await moduleRef.init();
    manager = moduleRef.get(ManagerService);
    sql = moduleRef.get<Sql>(SQL);

    const users = await sql<{ id: string }[]>`
      insert into users (name, email, phone, role)
      values ('Тест Клиент',   'spec-mgr-client@example.com',  '+79990000011', 'user'),
             ('Тест Менеджер', 'spec-mgr-manager@example.com', '+79990000012', 'manager')
      returning id`;
    clientId = users[0]!.id;
    managerId = users[1]!.id;

    const cars = await sql<{ id: number }[]>`
      select id::int as id from catalog_items order by id limit 2`;
    carId = cars[0]!.id;
    otherCarId = cars[1]!.id;
  });

  afterEach(async () => {
    await sql`delete from test_drives where user_id = ${clientId}`;
  });

  afterAll(async () => {
    await sql`delete from users where id in (${clientId}, ${managerId})`;
    await moduleRef.close();
  });

  /**
   * Записи заводятся напрямую: через клиентский сервис прошедший день
   * не создать (окно TD-5), а менеджеру нужны как раз такие.
   */
  const addTestDrive = async (
    day: string,
    hour: number,
    car = carId,
    comment: string | null = null,
  ) => {
    const [row] = await sql<{ id: number }[]>`
      insert into test_drives (user_id, car_id, starts_at, phone, comment)
      values (${clientId}, ${car}, ${slotInstant(day, hour)}, '+79990000099', ${comment})
      returning id::int as id`;
    return row!.id;
  };

  describe("GET /api/manager/test-drives", () => {
    it("отдаёт записи дня с данными клиента, по времени", async () => {
      const second = await addTestDrive(futureDay, 15, carId, "Перезвоните");
      const first = await addTestDrive(futureDay, 11);

      const day = await manager.getDay({ date: futureDay });

      expect(managerTestDrivesSchema.parse(day)).toEqual(day);
      expect(day.timeZone).toBe("Europe/Moscow");
      expect(day.items.map((item) => item.id)).toEqual([first, second]);
      expect(day.items[0]).toMatchObject({
        time: "11:00",
        status: "scheduled",
        started: false,
        client: {
          name: "Тест Клиент",
          email: "spec-mgr-client@example.com",
          phone: "+79990000011",
        },
      });
      expect(day.items[1]!.comment).toBe("Перезвоните");
    });

    it("не берёт записи соседних дней", async () => {
      await addTestDrive(futureDay, 10);
      await addTestDrive(pastDay, 10);

      const day = await manager.getDay({ date: futureDay });
      expect(day.items).toHaveLength(1);
    });

    it("фильтрует по автомобилю и по статусу", async () => {
      const mine = await addTestDrive(futureDay, 12, carId);
      const other = await addTestDrive(futureDay, 13, otherCarId);
      await manager.close(managerId, other, {
        status: "cancelled",
        cancelReason: "Машина в сервисе",
      });

      const byCar = await manager.getDay({ date: futureDay, carId });
      expect(byCar.items.map((item) => item.id)).toEqual([mine]);

      const byStatus = await manager.getDay({ date: futureDay, status: "cancelled" });
      expect(byStatus.items.map((item) => item.id)).toEqual([other]);
      expect(byStatus.items[0]!.cancelReason).toBe("Машина в сервисе");
    });

    it("прошедшая запись помечена started — ждёт отметки результата", async () => {
      await addTestDrive(pastDay, 12);

      const day = await manager.getDay({ date: pastDay });
      expect(day.items[0]).toMatchObject({ started: true, status: "scheduled" });
    });
  });

  describe("PATCH /api/manager/test-drives/:id", () => {
    it("отмечает результат визита и запоминает, кто и когда закрыл", async () => {
      const id = await addTestDrive(pastDay, 14);

      const closed = await manager.close(managerId, id, { status: "completed" });
      expect(closed).toMatchObject({ id, status: "completed", cancelReason: null });

      const [row] = await sql<{ status: string; closedBy: string; closedAt: Date }[]>`
        select status, closed_by, closed_at from test_drives where id = ${id}`;
      expect(row).toMatchObject({ status: "completed", closedBy: managerId });
      expect(row!.closedAt).toBeInstanceOf(Date);
    });

    it("отменяет будущую запись с причиной", async () => {
      const id = await addTestDrive(futureDay, 16);

      const closed = await manager.close(managerId, id, {
        status: "cancelled",
        cancelReason: "Автомобиль на сервисе",
      });

      expect(closed).toMatchObject({ status: "cancelled", cancelReason: "Автомобиль на сервисе" });
    });

    it("повторное закрытие — ALREADY_CLOSED", async () => {
      const id = await addTestDrive(pastDay, 15);
      await manager.close(managerId, id, { status: "no_show" });

      await expect(manager.close(managerId, id, { status: "completed" })).rejects.toMatchObject({
        code: "ALREADY_CLOSED",
        status: 409,
      });
    });

    it("результат визита до начала слота — SLOT_NOT_STARTED", async () => {
      const id = await addTestDrive(futureDay, 17);

      await expect(manager.close(managerId, id, { status: "completed" })).rejects.toMatchObject({
        code: "SLOT_NOT_STARTED",
        status: 422,
      });
    });

    it("отмена после начала слота — TOO_LATE_TO_CANCEL", async () => {
      const id = await addTestDrive(pastDay, 16);

      await expect(
        manager.close(managerId, id, { status: "cancelled", cancelReason: "Передумали" }),
      ).rejects.toMatchObject({ code: "TOO_LATE_TO_CANCEL", status: 422 });
    });

    it("несуществующая запись — NOT_FOUND", async () => {
      await expect(
        manager.close(managerId, 999_999, { status: "completed" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    });
  });

  describe("Тело PATCH (contracts)", () => {
    it("отмена без причины не проходит валидацию", () => {
      expect(closeTestDriveSchema.safeParse({ status: "cancelled" }).success).toBe(false);
      expect(
        closeTestDriveSchema.safeParse({ status: "cancelled", cancelReason: "   " }).success,
      ).toBe(false);
    });

    it("у результата визита причины быть не должно", () => {
      expect(
        closeTestDriveSchema.safeParse({ status: "completed", cancelReason: "нет" }).success,
      ).toBe(false);
      expect(closeTestDriveSchema.safeParse({ status: "completed" }).success).toBe(true);
    });

    it("scheduled обратно не ставится", () => {
      expect(closeTestDriveSchema.safeParse({ status: "scheduled" }).success).toBe(false);
    });
  });
});
