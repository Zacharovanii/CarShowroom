import { Test, type TestingModule } from "@nestjs/testing";
import { CARS_PAGE_SIZE, carDetailsSchema, carsResponseSchema } from "@carshowroom/contracts";
import { ConfigModule } from "../config/config.module.js";
import { DatabaseModule, SQL, type Sql } from "../db/db.module.js";
import { AppError } from "../common/app-error.js";
import { CatalogModule } from "./catalog.module.js";
import { CatalogService } from "./catalog.service.js";

// Тесты каталога ходят в локальную базу с применёнными миграциями и seed-ом
// (npm run db:migrate && npm run db:seed): проверять надо именно SQL, а на
// заглушках репозитория от такой проверки ничего не остаётся.
//
// Модуль auth сюда не подключается: каталог от него не зависит, а поднимать
// Better Auth ради трёх GET-ов незачем.

describe("Каталог", () => {
  let moduleRef: TestingModule;
  let catalog: CatalogService;
  let sql: Sql;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, CatalogModule],
    }).compile();

    await moduleRef.init();
    catalog = moduleRef.get(CatalogService);
    sql = moduleRef.get<Sql>(SQL);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  const query = (params: Record<string, unknown> = {}) =>
    ({ sort: "newest", page: 1, ...params }) as Parameters<CatalogService["getCars"]>[0];

  describe("GET /api/catalog/filters", () => {
    it("отдаёт три справочника, отсортированных по position", async () => {
      const filters = await catalog.getFilters();

      expect(filters.series.length).toBeGreaterThan(0);
      expect(filters.fuelTypes.map((option) => option.name)).toContain("Электро");

      for (const list of [filters.series, filters.bodyTypes, filters.fuelTypes]) {
        const positions = list.map((option) => option.position);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
      }
    });
  });

  describe("GET /api/cars", () => {
    it("ответ соответствует контракту", async () => {
      const response = await catalog.getCars(query());
      expect(carsResponseSchema.parse(response)).toEqual(response);
    });

    it("комбинирует фильтры: каждое условие сужает выборку", async () => {
      const { fuelTypes, bodyTypes } = await catalog.getFilters();
      const petrol = fuelTypes.find((option) => option.name === "Бензин")!;
      const sedan = bodyTypes.find((option) => option.name === "Седан")!;

      const byFuel = await catalog.getCars(query({ fuel: petrol.id }));
      const byFuelAndBody = await catalog.getCars(query({ fuel: petrol.id, body: sedan.id }));
      const withDrive = await catalog.getCars(
        query({ fuel: petrol.id, body: sedan.id, drive: "xdrive" }),
      );

      expect(byFuel.total).toBeGreaterThan(byFuelAndBody.total);
      expect(byFuelAndBody.total).toBeGreaterThan(withDrive.total);

      expect(withDrive.items.map((car) => car.slug).sort()).toEqual([
        "750li-xdrive",
        "m340i-xdrive",
      ]);
      for (const car of withDrive.items) {
        expect(car.fuelTypeName).toBe("Бензин");
        expect(car.bodyTypeName).toBe("Седан");
        expect(car.driveType).toBe("xdrive");
      }
    });

    it("фильтрует по названию и диапазону цены", async () => {
      const found = await catalog.getCars(query({ q: "x5" }));
      expect(found.items.map((car) => car.slug)).toEqual(["x5-xdrive40i"]);

      const inRange = await catalog.getCars(query({ priceMin: "5000000", priceMax: "8000000" }));
      expect(inRange.items.length).toBeGreaterThan(0);
      for (const car of inRange.items) {
        expect(Number(car.price)).toBeGreaterThanOrEqual(5_000_000);
        expect(Number(car.price)).toBeLessThanOrEqual(8_000_000);
      }

      const nothing = await catalog.getCars(query({ q: "нет такого автомобиля" }));
      expect(nothing.items).toEqual([]);
      expect(nothing.total).toBe(0);
      expect(nothing.totalPages).toBe(0);
    });

    it("сортирует по цене в обе стороны и по новизне", async () => {
      const asc = await catalog.getCars(query({ sort: "price-asc" }));
      const desc = await catalog.getCars(query({ sort: "price-desc" }));

      const prices = asc.items.map((car) => Number(car.price));
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
      expect(desc.items[0]!.slug).not.toBe(asc.items[0]!.slug);
      expect(Number(desc.items[0]!.price)).toBeGreaterThan(Number(asc.items[0]!.price));

      // «Новизна» — порядок добавления в каталог (created_at), сверяем с id:
      // seed вставляет автомобили одним insert, id растут вместе со временем.
      const newest = await catalog.getCars(query({ sort: "newest" }));
      const ids = newest.items.map((car) => car.id);
      expect(ids).toEqual([...ids].sort((a, b) => b - a));
    });

    it("режет выборку на страницы, не повторяя и не теряя автомобили", async () => {
      const first = await catalog.getCars(query({ sort: "price-asc", page: 1 }));

      expect(first.pageSize).toBe(CARS_PAGE_SIZE);
      expect(first.items).toHaveLength(CARS_PAGE_SIZE);
      expect(first.totalPages).toBe(Math.ceil(first.total / CARS_PAGE_SIZE));
      expect(first.totalPages).toBeGreaterThan(1);

      const slugs = first.items.map((car) => car.slug);
      for (let page = 2; page <= first.totalPages; page++) {
        const next = await catalog.getCars(query({ sort: "price-asc", page }));
        expect(next.total).toBe(first.total);
        slugs.push(...next.items.map((car) => car.slug));
      }
      expect(slugs).toHaveLength(first.total);
      expect(new Set(slugs).size).toBe(first.total);

      // страница за последней — пустая, но общее число известно
      const beyond = await catalog.getCars(query({ page: first.totalPages + 1 }));
      expect(beyond.items).toEqual([]);
      expect(beyond.total).toBe(first.total);
    });
  });

  describe("GET /api/cars/:slug", () => {
    it("отдаёт карточку по контракту: фото по порядку, палитра, 3D", async () => {
      const car = await catalog.getCarBySlug("x5-xdrive40i");

      expect(carDetailsSchema.parse(car)).toEqual(car);
      expect(car.name).toBe("BMW X5 xDrive40i");
      // деньги и дробные характеристики — строки (инвариант контракта)
      expect(typeof car.price).toBe("string");
      expect(typeof car.accelerationS).toBe("string");
      expect(car.model3dPath).toBe("/assets/models/x5-xdrive40i.glb");
      expect(car.paintMaterial).toBe("CarPaint");
      expect(car.colors.length).toBeGreaterThan(0);

      const positions = await sql<{ path: string }[]>`
        select path from car_images where car_id = ${car.id} order by position`;
      expect(car.images.map((image) => image.path)).toEqual(positions.map((row) => row.path));
    });

    it("несуществующий slug — NOT_FOUND и 404", async () => {
      await expect(catalog.getCarBySlug("no-such-car")).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });
      await expect(catalog.getCarBySlug("no-such-car")).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("снятый с публикации автомобиль", () => {
    const slug = "spec-unpublished-car";

    beforeAll(async () => {
      await sql`
        insert into cars (series_id, body_type_id, fuel_type_id, slug, name, model_year,
                          description, drive_type, power_hp, acceleration_s, top_speed_kmh,
                          price, is_published)
        values ((select id from series where name = 'BMW Z'),
                (select id from body_types where name = 'Родстер'),
                (select id from fuel_types where name = 'Бензин'),
                ${slug}, 'BMW Z4 (тест, снят с публикации)', 2025,
                'Черновик карточки: в каталоге его быть не должно.',
                'rwd', 197, 6.6, 240, 4990000, false)`;
    });

    afterAll(async () => {
      await sql`delete from cars where slug = ${slug}`;
    });

    it("не попадает в список", async () => {
      const all = await catalog.getCars(query({ q: "BMW" }));
      expect(all.items.map((car) => car.slug)).not.toContain(slug);

      const targeted = await catalog.getCars(query({ q: "снят с публикации" }));
      expect(targeted.items).toEqual([]);
      expect(targeted.total).toBe(0);
    });

    it("не открывается по slug", async () => {
      await expect(catalog.getCarBySlug(slug)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});
