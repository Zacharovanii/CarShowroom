import { randomUUID } from "node:crypto";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  adminCarOptionsSchema,
  adminCarSchema,
  adminCarsResponseSchema,
  type CreateAdminCar,
} from "@carshowroom/contracts";
import { ConfigModule } from "../config/config.module.js";
import { DatabaseModule, SQL, type Sql } from "../db/db.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { StorageService } from "../storage/storage.service.js";
import { AdminCarsModule } from "./admin-cars.module.js";
import { AdminCarsService } from "./admin-cars.service.js";

// Ходят в локальную базу и MinIO (npm run db:up): проверяется SQL карточек,
// перевод ошибок Postgres в коды API и уборка файлов после удаления.
// Свои данные тест убирает за собой — slug начинаются с spec-acars-,
// email пользователей — тоже.
//
// Роль проверяет guard на контроллере, здесь её нет: доступ по ролям —
// apps/api/test/admin-cars.e2e.spec.ts. Модуль auth сюда не подтягивается
// (admin-cars не импортирует auth.ts), поэтому его пул закрывать не нужно.

const PREFIX = "spec-acars-";

describe("Админ: карточки автомобилей", () => {
  let moduleRef: TestingModule;
  let cars: AdminCarsService;
  let storage: StorageService;
  let sql: Sql;

  let base: Omit<CreateAdminCar, "name" | "slug">;
  let colorA: number;
  let colorB: number;
  /** Ключи MinIO, которые тест положил: убираются в afterAll, если остались. */
  const keys: string[] = [];
  let counter = 0;

  /** Уникальные name и slug для каждого автомобиля теста. */
  const fresh = (): Pick<CreateAdminCar, "name" | "slug"> => {
    counter += 1;
    return { name: `Spec ACars ${counter}`, slug: `${PREFIX}${counter}` };
  };

  const create = (overrides: Partial<CreateAdminCar> = {}) =>
    cars.createCar({ ...base, ...fresh(), ...overrides });

  const addImage = async (carId: number, position: number, path?: string) => {
    const imagePath = path ?? `/media/cars/${carId}/${randomUUID()}.webp`;
    await sql`
      insert into car_images (car_id, position, path, alt)
      values (${carId}, ${position}, ${imagePath}, 'alt')`;
    return imagePath;
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, StorageModule, AdminCarsModule],
    }).compile();

    await moduleRef.init();
    cars = moduleRef.get(AdminCarsService);
    storage = moduleRef.get(StorageService);
    sql = moduleRef.get<Sql>(SQL);

    const [refs] = await sql<{ seriesId: number; bodyTypeId: number; fuelTypeId: number }[]>`
      select (select min(id) from series)::int as series_id,
             (select min(id) from body_types)::int as body_type_id,
             (select min(id) from fuel_types)::int as fuel_type_id`;
    const colors = await sql<
      { id: number }[]
    >`select id::int as id from colors order by id limit 2`;
    colorA = colors[0]!.id;
    colorB = colors[1]!.id;

    base = {
      seriesId: refs!.seriesId,
      bodyTypeId: refs!.bodyTypeId,
      fuelTypeId: refs!.fuelTypeId,
      driveType: "xdrive",
      modelYear: 2026,
      description: "Тестовый автомобиль",
      powerHp: 300,
      accelerationS: "4.9",
      topSpeedKmh: 250,
      price: "5000000.00",
      colorIds: [colorB, colorA],
    };
  });

  afterEach(async () => {
    await sql`
      delete from test_drives
      where car_id in (select id from cars where slug like ${PREFIX + "%"})`;
    await sql`delete from cars where slug like ${PREFIX + "%"}`;
    await sql`delete from users where email like ${PREFIX + "%"}`;
  });

  afterAll(async () => {
    await Promise.all(keys.map((key) => storage.delete(key)));
    await moduleRef.close();
  });

  describe("POST /api/admin/cars", () => {
    it("создаёт черновик с отсортированной палитрой", async () => {
      const car = await create();

      expect(adminCarSchema.parse(car)).toEqual(car);
      expect(car).toMatchObject({
        isPublished: false,
        colorIds: [colorA, colorB].sort((a, b) => a - b),
        testDrivesCount: 0,
        images: [],
        model: null,
        price: "5000000.00",
        accelerationS: "4.9",
      });

      const [row] = await sql<{ isPublished: boolean }[]>`
        select is_published from cars where id = ${car.id}`;
      expect(row?.isPublished).toBe(false);
    });

    it("занятые slug и название — SLUG_TAKEN и NAME_TAKEN с полем", async () => {
      const car = await create();

      await expect(create({ slug: car.slug })).rejects.toMatchObject({
        code: "SLUG_TAKEN",
        status: 409,
        details: { field: "slug" },
      });
      await expect(create({ name: car.name })).rejects.toMatchObject({
        code: "NAME_TAKEN",
        status: 409,
        details: { field: "name" },
      });
    });

    it("несуществующие серия и цвет — VALIDATION_FAILED, строка не создаётся", async () => {
      const [max] = await sql<{ series: number; color: number }[]>`
        select (select max(id) from series)::int as series,
               (select max(id) from colors)::int as color`;

      const badSeries = fresh();
      await expect(
        cars.createCar({ ...base, ...badSeries, seriesId: max!.series + 1000 }),
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        status: 400,
        details: { field: "seriesId" },
      });

      const badColor = fresh();
      await expect(
        cars.createCar({ ...base, ...badColor, colorIds: [colorA, max!.color + 1000] }),
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        status: 400,
        details: { field: "colorIds" },
      });

      // палитра вставляется в той же транзакции — откат убирает и cars
      const rows = await sql`
        select 1 from cars where slug in (${badSeries.slug}, ${badColor.slug})`;
      expect(rows).toHaveLength(0);
    });
  });

  describe("GET /api/admin/cars/:id", () => {
    it("нет такого — NOT_FOUND", async () => {
      await expect(cars.getCar(999_999_999)).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });
    });
  });

  describe("PATCH /api/admin/cars/:id", () => {
    it("меняет только переданные поля, colorIds заменяет палитру", async () => {
      const car = await create();

      const updated = await cars.updateCar(car.id, { price: "4200000.50", colorIds: [colorA] });

      expect(adminCarSchema.parse(updated)).toEqual(updated);
      expect(updated).toEqual({ ...car, price: "4200000.50", colorIds: [colorA] });
    });

    it("только colorIds: [] очищает палитру, поля не трогаются", async () => {
      const car = await create();

      const updated = await cars.updateCar(car.id, { colorIds: [] });
      expect(updated).toEqual({ ...car, colorIds: [] });
    });

    it("нет такого — NOT_FOUND (и с полями, и с одной палитрой)", async () => {
      await expect(cars.updateCar(999_999_999, { price: "1.00" })).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });
      await expect(cars.updateCar(999_999_999, { colorIds: [colorA] })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("чужие slug и название — SLUG_TAKEN и NAME_TAKEN, изменения откатываются", async () => {
      const first = await create();
      const second = await create();

      await expect(
        cars.updateCar(second.id, { slug: first.slug, colorIds: [] }),
      ).rejects.toMatchObject({ code: "SLUG_TAKEN", details: { field: "slug" } });
      await expect(cars.updateCar(second.id, { name: first.name })).rejects.toMatchObject({
        code: "NAME_TAKEN",
        details: { field: "name" },
      });

      expect(await cars.getCar(second.id)).toEqual(second);
    });

    it("несуществующий цвет — VALIDATION_FAILED, старая палитра на месте", async () => {
      const car = await create();
      const [max] = await sql<{ color: number }[]>`select max(id)::int as color from colors`;

      await expect(cars.updateCar(car.id, { colorIds: [max!.color + 1000] })).rejects.toMatchObject(
        { code: "VALIDATION_FAILED", details: { field: "colorIds" } },
      );

      expect((await cars.getCar(car.id)).colorIds).toEqual(car.colorIds);
    });
  });

  describe("GET /api/admin/cars", () => {
    it("фильтр по статусу, поиск по slug и названию, обложка — фото position 1", async () => {
      const draft = await create();
      const published = await create();
      await addImage(published.id, 2);
      const cover = await addImage(published.id, 1);
      await cars.publishCar(published.id);

      const all = await cars.getCars({ q: PREFIX, status: "all", page: 1 });
      expect(adminCarsResponseSchema.parse(all)).toEqual(all);
      expect(all.items.map((item) => item.id).sort()).toEqual([draft.id, published.id].sort());

      const drafts = await cars.getCars({ q: PREFIX, status: "draft", page: 1 });
      expect(drafts.items.map((item) => item.id)).toEqual([draft.id]);
      expect(drafts.items[0]).toMatchObject({ isPublished: false, coverPath: null, has3d: false });

      const pub = await cars.getCars({ q: PREFIX, status: "published", page: 1 });
      expect(pub.total).toBe(1);
      expect(pub.items[0]).toMatchObject({ id: published.id, isPublished: true, coverPath: cover });

      const bySlug = await cars.getCars({ q: draft.slug, status: "all", page: 1 });
      expect(bySlug.items.map((item) => item.id)).toEqual([draft.id]);

      // поиск без учёта регистра
      const byName = await cars.getCars({
        q: published.name.toUpperCase(),
        status: "all",
        page: 1,
      });
      expect(byName.items.map((item) => item.id)).toEqual([published.id]);
    });
  });

  describe("GET /api/admin/cars/options", () => {
    it("справочники по контракту и не пустые", async () => {
      const options = await cars.getOptions();

      expect(adminCarOptionsSchema.parse(options)).toEqual(options);
      expect(options.series.length).toBeGreaterThan(0);
      expect(options.bodyTypes.length).toBeGreaterThan(0);
      expect(options.fuelTypes.length).toBeGreaterThan(0);
      expect(options.colors.length).toBeGreaterThan(0);
    });
  });

  describe("publish / unpublish", () => {
    it("без фото — CAR_NOT_READY; с фото публикуется, повторы идемпотентны", async () => {
      const car = await create();

      await expect(cars.publishCar(car.id)).rejects.toMatchObject({
        code: "CAR_NOT_READY",
        status: 409,
      });
      expect((await cars.getCar(car.id)).isPublished).toBe(false);

      await addImage(car.id, 1);
      expect((await cars.publishCar(car.id)).isPublished).toBe(true);
      expect((await cars.publishCar(car.id)).isPublished).toBe(true);

      expect((await cars.unpublishCar(car.id)).isPublished).toBe(false);
      expect((await cars.unpublishCar(car.id)).isPublished).toBe(false);
    });

    it("нет такого — NOT_FOUND", async () => {
      await expect(cars.publishCar(999_999_999)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(cars.unpublishCar(999_999_999)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("DELETE /api/admin/cars/:id", () => {
    it("есть запись на тест-драйв — CAR_HAS_TEST_DRIVES, автомобиль на месте", async () => {
      const car = await create();
      const [user] = await sql<{ id: string }[]>`
        insert into users (name, email, phone, role)
        values ('Спек Клиент', ${PREFIX + "client@example.com"}, '+79990000051', 'user')
        returning id`;
      // закрытая запись в прошлом: удаление запрещено при записи любого статуса
      await sql`
        insert into test_drives (user_id, car_id, starts_at, phone, status, closed_at, closed_by)
        values (${user!.id}, ${car.id}, date_trunc('hour', now()) - interval '3 days',
                '+79990000051', 'completed', now(), ${user!.id})`;

      expect((await cars.getCar(car.id)).testDrivesCount).toBe(1);

      await expect(cars.deleteCar(car.id)).rejects.toMatchObject({
        code: "CAR_HAS_TEST_DRIVES",
        status: 409,
      });
      expect((await cars.getCar(car.id)).id).toBe(car.id);
    });

    it("удаляет автомобиль и его объекты MinIO, /assets/... не трогает", async () => {
      const car = await create();
      const key = `cars/${car.id}/${randomUUID()}.webp`;
      keys.push(key);
      await storage.put(key, Buffer.from("webp"), "image/webp");
      await addImage(car.id, 1, `/media/${key}`);
      await addImage(car.id, 2, `/assets/spec-acars/${car.slug}-2.webp`);

      const deleteSpy = vi.spyOn(storage, "delete");
      try {
        await cars.deleteCar(car.id);
        expect(deleteSpy.mock.calls).toEqual([[key]]);
      } finally {
        deleteSpy.mockRestore();
      }

      expect(await storage.get(key)).toBeUndefined();
      const rows = await sql`select 1 from cars where id = ${car.id}`;
      expect(rows).toHaveLength(0);
      const images = await sql`select 1 from car_images where car_id = ${car.id}`;
      expect(images).toHaveLength(0);

      await expect(cars.deleteCar(car.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });
    });

    it("ошибка хранилища при уборке не роняет запрос", async () => {
      const deleteSpy = vi.spyOn(storage, "delete").mockRejectedValue(new Error("MinIO упал"));
      try {
        await expect(
          cars.deleteMediaObjects([`/media/cars/1/${randomUUID()}.webp`, "/assets/cars/x.webp"]),
        ).resolves.toBeUndefined();
        expect(deleteSpy).toHaveBeenCalledTimes(1);
      } finally {
        deleteSpy.mockRestore();
      }
    });
  });
});
