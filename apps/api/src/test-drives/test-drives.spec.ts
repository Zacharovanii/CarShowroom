import { Test, type TestingModule } from "@nestjs/testing";
import { myTestDrivesSchema, slotsResponseSchema } from "@carshowroom/contracts";
import { ConfigModule } from "../config/config.module.js";
import { DatabaseModule, SQL, type Sql } from "../db/db.module.js";
import { AllExceptionsFilter } from "../common/all-exceptions.filter.js";
import { salonDay, slotInstant } from "./rules.js";
import { TestDrivesModule } from "./test-drives.module.js";
import { TestDrivesService } from "./test-drives.service.js";

// Как и тесты каталога, ходят в локальную базу с миграциями и seed-ом:
// проверяется в том числе SQL и уникальные индексы, а на заглушках
// репозитория от такой проверки ничего не остаётся.
//
// Свои данные (два клиента и их записи) тест заводит сам и убирает за собой.
// Модуль auth не подключается: сервис принимает userId, а роль проверяет
// guard на контроллере.

describe("Тест-драйвы", () => {
  let moduleRef: TestingModule;
  let testDrives: TestDrivesService;
  let sql: Sql;

  let clientId: string;
  let otherId: string;
  let carId: number;
  let carSlug: string;
  let otherCarId: number;

  // База живая и общая с dev-ом, поэтому день берём заведомо свободный:
  // через 10 дней (внутри окна TD-5) и в отдельном году от seed-данных нет.
  const now = new Date();
  const date = salonDay(new Date(now.getTime() + 10 * 24 * 3_600_000));
  const slotAt = (hour: number) => slotInstant(date, hour).toISOString();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, TestDrivesModule],
    }).compile();

    await moduleRef.init();
    testDrives = moduleRef.get(TestDrivesService);
    sql = moduleRef.get<Sql>(SQL);

    const users = await sql<{ id: string }[]>`
      insert into users (name, email, phone)
      values ('Тест Клиент', 'spec-td-client@example.com', '+79990000001'),
             ('Тест Сосед',  'spec-td-other@example.com',  '+79990000002')
      returning id`;
    clientId = users[0]!.id;
    otherId = users[1]!.id;

    const cars = await sql<{ id: number; slug: string }[]>`
      select id::int as id, slug from catalog_items order by id limit 2`;
    carId = cars[0]!.id;
    carSlug = cars[0]!.slug;
    otherCarId = cars[1]!.id;
  });

  afterEach(async () => {
    await sql`delete from test_drives where user_id in (${clientId}, ${otherId})`;
  });

  afterAll(async () => {
    await sql`delete from users where id in (${clientId}, ${otherId})`;
    await moduleRef.close();
  });

  describe("GET /api/cars/:slug/slots", () => {
    it("отдаёт 9 слотов дня по контракту", async () => {
      const response = await testDrives.getSlots(carSlug, date);

      expect(slotsResponseSchema.parse(response)).toEqual(response);
      expect(response.timeZone).toBe("Europe/Moscow");
      expect(response.slots).toHaveLength(9);
      expect(response.slots.every((slot) => slot.free)).toBe(true);
    });

    it("занятый слот перестаёт быть свободным, а после отмены возвращается", async () => {
      const startsAt = slotAt(12);
      const created = await testDrives.create(clientId, {
        carId,
        startsAt,
        phone: "+79990000001",
      });

      const taken = await testDrives.getSlots(carSlug, date);
      expect(taken.slots.find((slot) => slot.startsAt === startsAt)).toMatchObject({
        free: false,
        bookable: false,
      });

      await testDrives.cancel(clientId, created.id);

      const free = await testDrives.getSlots(carSlug, date);
      expect(free.slots.find((slot) => slot.startsAt === startsAt)).toMatchObject({
        free: true,
        bookable: true,
      });
    });

    it("несуществующий автомобиль — NOT_FOUND", async () => {
      await expect(testDrives.getSlots("no-such-car", date)).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });
    });
  });

  describe("POST /api/me/test-drives", () => {
    it("создаёт запись в статусе scheduled", async () => {
      const created = await testDrives.create(clientId, {
        carId,
        startsAt: slotAt(10),
        phone: "+79990000001",
        comment: "Приеду с правами",
      });

      expect(created).toMatchObject({
        status: "scheduled",
        phone: "+79990000001",
        comment: "Приеду с правами",
        cancellable: true,
      });
      expect(created.car.id).toBe(carId);
    });

    it("второй клиент на тот же слот — unique_violation, фильтр отдаёт 409 SLOT_TAKEN", async () => {
      const startsAt = slotAt(11);
      await testDrives.create(clientId, { carId, startsAt, phone: "+79990000001" });

      // Занятость слота заранее не проверяется: её ловит частичный уникальный
      // индекс test_drives_car_slot_uq. Ошибку драйвера в код API переводит
      // глобальный фильтр — его тут и проверяем, вместе с сервисом.
      const conflict = await testDrives
        .create(otherId, { carId, startsAt, phone: "+79990000002" })
        .then(
          () => null,
          (error: unknown) => error,
        );

      expect(conflict).toMatchObject({ code: "23505", constraint_name: "test_drives_car_slot_uq" });
      expect(toApiResponse(conflict)).toEqual({
        status: 409,
        body: { error: { code: "SLOT_TAKEN", message: "Слот уже занят" } },
      });
    });

    it("третья активная запись — TOO_MANY_ACTIVE", async () => {
      await testDrives.create(clientId, { carId, startsAt: slotAt(13), phone: "+79990000001" });
      await testDrives.create(clientId, { carId, startsAt: slotAt(14), phone: "+79990000001" });

      await expect(
        testDrives.create(clientId, { carId, startsAt: slotAt(15), phone: "+79990000001" }),
      ).rejects.toMatchObject({ code: "TOO_MANY_ACTIVE", status: 422 });
    });

    it("две записи клиента на одно время — TOO_MANY_ACTIVE, даже на разные автомобили", async () => {
      const startsAt = slotAt(16);
      await testDrives.create(clientId, { carId, startsAt, phone: "+79990000001" });

      await expect(
        testDrives.create(clientId, { carId: otherCarId, startsAt, phone: "+79990000001" }),
      ).rejects.toMatchObject({ code: "TOO_MANY_ACTIVE" });
    });

    it("слот вне сетки — SLOT_NOT_ON_GRID", async () => {
      const halfPast = new Date(slotAt(12));
      halfPast.setMinutes(30);

      await expect(
        testDrives.create(clientId, {
          carId,
          startsAt: halfPast.toISOString(),
          phone: "+79990000001",
        }),
      ).rejects.toMatchObject({ code: "SLOT_NOT_ON_GRID", status: 422 });
    });

    it("слот вне окна записи — SLOT_OUT_OF_RANGE", async () => {
      const longAgo = salonDay(new Date(now.getTime() - 3 * 24 * 3_600_000));
      const tooFar = salonDay(new Date(now.getTime() + 40 * 24 * 3_600_000));

      for (const day of [longAgo, tooFar]) {
        await expect(
          testDrives.create(clientId, {
            carId,
            startsAt: slotInstant(day, 12).toISOString(),
            phone: "+79990000001",
          }),
        ).rejects.toMatchObject({ code: "SLOT_OUT_OF_RANGE", status: 422 });
      }
    });

    it("несуществующий автомобиль — NOT_FOUND", async () => {
      await expect(
        testDrives.create(clientId, {
          carId: 999_999,
          startsAt: slotAt(12),
          phone: "+79990000001",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("GET /api/me/test-drives", () => {
    it("делит записи на предстоящие и историю и не показывает чужие", async () => {
      const upcoming = await testDrives.create(clientId, {
        carId,
        startsAt: slotAt(10),
        phone: "+79990000001",
      });
      await testDrives.create(otherId, {
        carId,
        startsAt: slotAt(11),
        phone: "+79990000002",
      });

      // прошедшая запись: через сервис её не создать (окно TD-5), поэтому
      // кладём напрямую — это данные, а не сценарий
      await sql`
        insert into test_drives (user_id, car_id, starts_at, phone, status, closed_at, closed_by)
        values (${clientId}, ${carId}, ${slotInstant(salonDay(new Date(now.getTime() - 5 * 24 * 3_600_000)), 12)},
                '+79990000001', 'completed', now(), ${clientId})`;

      const mine = await testDrives.getMyTestDrives(clientId);

      expect(myTestDrivesSchema.parse(mine)).toEqual(mine);
      expect(mine.upcoming.map((item) => item.id)).toEqual([upcoming.id]);
      expect(mine.history).toHaveLength(1);
      expect(mine.history[0]).toMatchObject({ status: "completed", cancellable: false });
    });
  });

  describe("POST /api/me/test-drives/:id/cancel", () => {
    it("отменяет свою будущую запись", async () => {
      const created = await testDrives.create(clientId, {
        carId,
        startsAt: slotAt(17),
        phone: "+79990000001",
      });

      const cancelled = await testDrives.cancel(clientId, created.id);
      expect(cancelled).toMatchObject({ id: created.id, status: "cancelled", cancellable: false });

      const [row] = await sql<{ status: string; closedBy: string }[]>`
        select status, closed_by from test_drives where id = ${created.id}`;
      expect(row).toMatchObject({ status: "cancelled", closedBy: clientId });
    });

    it("чужая запись — NOT_FOUND, а не FORBIDDEN", async () => {
      const foreign = await testDrives.create(otherId, {
        carId,
        startsAt: slotAt(18),
        phone: "+79990000002",
      });

      await expect(testDrives.cancel(clientId, foreign.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });
    });

    it("уже закрытая запись — ALREADY_CLOSED", async () => {
      const created = await testDrives.create(clientId, {
        carId,
        startsAt: slotAt(13),
        phone: "+79990000001",
      });
      await testDrives.cancel(clientId, created.id);

      await expect(testDrives.cancel(clientId, created.id)).rejects.toMatchObject({
        code: "ALREADY_CLOSED",
        status: 409,
      });
    });

    it("слот уже начался — TOO_LATE_TO_CANCEL", async () => {
      const [row] = await sql<{ id: number }[]>`
        insert into test_drives (user_id, car_id, starts_at, phone)
        values (${clientId}, ${carId}, ${slotInstant(salonDay(new Date(now.getTime() - 24 * 3_600_000)), 12)},
                '+79990000001')
        returning id::int as id`;

      await expect(testDrives.cancel(clientId, row!.id)).rejects.toMatchObject({
        code: "TOO_LATE_TO_CANCEL",
        status: 422,
      });
    });
  });
});

/** Прогоняет ошибку через глобальный фильтр и возвращает то, что уйдёт клиенту. */
function toApiResponse(error: unknown): { status: number; body: unknown } {
  let status = 0;
  let body: unknown;
  const response = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return value;
    },
  };

  new AllExceptionsFilter().catch(error, {
    switchToHttp: () => ({ getResponse: () => response }),
  } as never);

  return { status, body };
}
