import { Inject, Injectable } from "@nestjs/common";
import { CARS_PAGE_SIZE, type CarsQuery } from "@carshowroom/contracts";
import { SQL, type Sql } from "../db/db.module.js";

// Типы строк, которые возвращает SQL (не типы ответа API — те живут только
// в contracts). Имена уже camelCase: DatabaseModule включает
// transform: postgres.camel.
//
// bigint везде приводится к ::int: postgres.js отдаёт int8 строкой, а id
// каталога заведомо помещается в число. numeric (price, acceleration_s)
// остаётся строкой намеренно — это деньги и дробные характеристики.

export interface FilterOptionRow {
  id: number;
  name: string;
  position: number;
}

export interface CarCardRow {
  id: number;
  slug: string;
  name: string;
  modelYear: number;
  price: string;
  driveType: "rwd" | "xdrive";
  powerHp: number;
  seriesName: string;
  bodyTypeName: string;
  fuelTypeName: string;
  coverPath: string | null;
  coverAlt: string | null;
  has3d: boolean;
}

export interface CarRow {
  id: number;
  slug: string;
  name: string;
  modelYear: number;
  description: string;
  price: string;
  seriesName: string;
  bodyTypeName: string;
  fuelTypeName: string;
  driveType: "rwd" | "xdrive";
  powerHp: number;
  accelerationS: string;
  topSpeedKmh: number;
  model3dPath: string | null;
  paintMaterial: string | null;
}

export interface CarImageRow {
  path: string;
  alt: string;
}

export interface CarColorRow {
  id: number;
  name: string;
  hex: string;
}

@Injectable()
export class CatalogRepository {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /** Справочники для фильтров: серии, кузова, типы двигателя. */
  async findFilterOptions(): Promise<{
    series: FilterOptionRow[];
    bodyTypes: FilterOptionRow[];
    fuelTypes: FilterOptionRow[];
  }> {
    const [series, bodyTypes, fuelTypes] = await Promise.all([
      this.sql<
        FilterOptionRow[]
      >`select id::int as id, name, position from series order by position`,
      this.sql<
        FilterOptionRow[]
      >`select id::int as id, name, position from body_types order by position`,
      this.sql<
        FilterOptionRow[]
      >`select id::int as id, name, position from fuel_types order by position`,
    ]);

    return { series: [...series], bodyTypes: [...bodyTypes], fuelTypes: [...fuelTypes] };
  }

  /**
   * Страница каталога. Читается из представления catalog_items: в нём уже
   * есть подписи справочников, обложка, флаг 3D и фильтр по is_published.
   */
  async findCars(query: CarsQuery): Promise<CarCardRow[]> {
    const offset = (query.page - 1) * CARS_PAGE_SIZE;

    // order by параметром не передаётся — только фрагментом из белого списка;
    // ключ приходит из z.enum, посторонней строки тут быть не может.
    // Вторым ключом всегда id: без него порядок строк с равной ценой
    // не определён и они могут повторяться на соседних страницах.
    const orderBy = {
      "price-asc": this.sql`ci.price asc, ci.id asc`,
      "price-desc": this.sql`ci.price desc, ci.id asc`,
      newest: this.sql`ci.created_at desc, ci.id desc`,
    }[query.sort];

    const rows = await this.sql<CarCardRow[]>`
      select ci.id::int as id,
             ci.slug,
             ci.name,
             ci.model_year::int,
             ci.price,
             ci.drive_type,
             ci.power_hp::int,
             ci.series_name,
             ci.body_type_name,
             ci.fuel_type_name,
             ci.cover_path,
             ci.cover_alt,
             ci.has_3d
      from catalog_items ci
      where ${this.carsFilter(query)}
      order by ${orderBy}
      limit ${CARS_PAGE_SIZE} offset ${offset}`;

    return [...rows];
  }

  /** Сколько всего автомобилей подходит под фильтры — для пагинации. */
  async countCars(query: CarsQuery): Promise<number> {
    const [row] = await this.sql<{ total: number }[]>`
      select count(*)::int as total
      from catalog_items ci
      where ${this.carsFilter(query)}`;

    return row?.total ?? 0;
  }

  /**
   * Условия фильтрации каталога — один фрагмент на два запроса (страница
   * и счётчик), чтобы правила отбора не разъехались между ними.
   *
   * Фильтры комбинируются по схеме «параметр не задан — условие истинно»:
   * запрос остаётся одним статичным текстом с плейсхолдерами, а не
   * собирается конкатенацией. Явные ::-касты нужны, потому что по одному
   * лишь null Postgres не может вывести тип параметра.
   */
  private carsFilter(query: CarsQuery) {
    const { q = null, series = null, body = null, fuel = null, drive = null } = query;
    const priceMin = query.priceMin ?? null;
    const priceMax = query.priceMax ?? null;

    return this.sql`
          (${q}::text is null or ci.name ilike '%' || ${q}::text || '%')
      and (${series}::bigint is null or ci.series_id = ${series}::bigint)
      and (${body}::bigint is null or ci.body_type_id = ${body}::bigint)
      and (${fuel}::bigint is null or ci.fuel_type_id = ${fuel}::bigint)
      and (${drive}::text is null or ci.drive_type = ${drive}::text)
      and (${priceMin}::numeric is null or ci.price >= ${priceMin}::numeric)
      and (${priceMax}::numeric is null or ci.price <= ${priceMax}::numeric)`;
  }

  /**
   * Автомобиль по slug. catalog_items отвечает за подписи справочников
   * и за отбор только опубликованных, cars — за то, чего в представлении
   * нет: описание, характеристики и 3D.
   */
  async findCarBySlug(slug: string): Promise<CarRow | undefined> {
    const rows = await this.sql<CarRow[]>`
      select ci.id::int as id,
             ci.slug,
             ci.name,
             ci.model_year::int,
             c.description,
             ci.price,
             ci.series_name,
             ci.body_type_name,
             ci.fuel_type_name,
             ci.drive_type,
             ci.power_hp::int,
             c.acceleration_s,
             c.top_speed_kmh::int,
             c.model_3d_path,
             c.paint_material
      from catalog_items ci
      join cars c on c.id = ci.id
      where ci.slug = ${slug}`;

    return rows[0];
  }

  /** Фото автомобиля по порядку; position = 1 — обложка. */
  async findCarImages(carId: number): Promise<CarImageRow[]> {
    const rows = await this.sql<CarImageRow[]>`
      select path, alt
      from car_images
      where car_id = ${carId}
      order by position`;

    return [...rows];
  }

  /** Палитра автомобиля. Своего порядка у связи нет — сортируем по справочнику. */
  async findCarColors(carId: number): Promise<CarColorRow[]> {
    const rows = await this.sql<CarColorRow[]>`
      select col.id::int as id, col.name, col.hex
      from car_colors cc
      join colors col on col.id = cc.color_id
      where cc.car_id = ${carId}
      order by col.id`;

    return [...rows];
  }
}
