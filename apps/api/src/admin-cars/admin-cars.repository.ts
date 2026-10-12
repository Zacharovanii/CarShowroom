import { Inject, Injectable } from "@nestjs/common";
import type postgres from "postgres";
import {
  ADMIN_CARS_PAGE_SIZE,
  type AdminCarsQuery,
  type CreateAdminCar,
  type DriveType,
  type UpdateAdminCar,
} from "@carshowroom/contracts";
import { SQL, type Sql } from "../db/db.module.js";

// Типы строк SQL (не типы ответа API — те только в contracts). Имена уже
// camelCase: DatabaseModule включает transform: postgres.camel. bigint
// приводится к ::int, numeric (price, acceleration_s) остаётся строкой —
// как в catalog.repository.

/** Соединение внутри `sql.begin(async (tx) => ...)`. */
export type Tx = postgres.TransactionSql;

export interface AdminCarListRow {
  id: number;
  slug: string;
  name: string;
  modelYear: number;
  price: string;
  seriesName: string;
  coverPath: string | null;
  isPublished: boolean;
  has3d: boolean;
}

export interface AdminCarRow {
  id: number;
  name: string;
  slug: string;
  seriesId: number;
  bodyTypeId: number;
  fuelTypeId: number;
  driveType: DriveType;
  modelYear: number;
  description: string;
  powerHp: number;
  accelerationS: string;
  topSpeedKmh: number;
  price: string;
  model3dPath: string | null;
  paintMaterial: string | null;
  isPublished: boolean;
  colorIds: number[];
  testDrivesCount: number;
}

export interface AdminCarImageRow {
  id: number;
  position: number;
  path: string;
  alt: string;
}

export interface OptionRow {
  id: number;
  name: string;
}

export interface ColorOptionRow {
  id: number;
  name: string;
  hex: string;
}

/** Что увидел publish под блокировкой строки — решение принимает сервис. */
export type PublishOutcome = "published" | "not_found" | "no_images";

/**
 * Исходы операций над фото и моделью под блокировкой автомобиля. Как и
 * PublishOutcome, ошибку по ним бросает сервис — уже после отката, чтобы
 * убрать загруженный объект. `oldPath` — путь, который транзакция отвязала:
 * его объект сервис удаляет из MinIO после коммита.
 */
export type ReplaceImageOutcome = "car_not_found" | "image_not_found" | { oldPath: string };
export type DeleteImageOutcome = ReplaceImageOutcome | "last_image";
export type ReorderImagesOutcome = "car_not_found" | "mismatch" | "reordered";

type CarFields = Omit<UpdateAdminCar, "colorIds">;

// Поле контракта → колонка cars. Белый список, а не transform драйвера:
// в `update ... set` уходят только эти колонки, и имя колонки видно здесь,
// а не выводится из имени поля. `satisfies` не даст забыть новое поле.
const CAR_COLUMNS = {
  name: "name",
  slug: "slug",
  seriesId: "series_id",
  bodyTypeId: "body_type_id",
  fuelTypeId: "fuel_type_id",
  driveType: "drive_type",
  modelYear: "model_year",
  description: "description",
  powerHp: "power_hp",
  accelerationS: "acceleration_s",
  topSpeedKmh: "top_speed_kmh",
  price: "price",
} as const satisfies Record<keyof CarFields, string>;

type CarColumn = (typeof CAR_COLUMNS)[keyof typeof CAR_COLUMNS];
type CarValues = Partial<Record<CarColumn, string | number>>;

/** Переданные поля карточки в колонки cars; `undefined` пропускаются. */
function toCarValues(fields: CarFields): CarValues {
  const values: CarValues = {};
  for (const [field, column] of Object.entries(CAR_COLUMNS) as [keyof CarFields, CarColumn][]) {
    const value = fields[field];
    if (value !== undefined) values[column] = value;
  }
  return values;
}

@Injectable()
export class AdminCarsRepository {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * Страница списка (UC-A3). Читается из cars, а не из catalog_items:
   * представление отдаёт только опубликованные, а админке нужны и черновики.
   */
  async findCars(query: AdminCarsQuery): Promise<AdminCarListRow[]> {
    const offset = (query.page - 1) * ADMIN_CARS_PAGE_SIZE;

    const rows = await this.sql<AdminCarListRow[]>`
      select c.id::int as id,
             c.slug,
             c.name,
             c.model_year::int,
             c.price,
             s.name as series_name,
             cover.path as cover_path,
             c.is_published,
             c.model_3d_path is not null as has_3d
      from cars c
      join series s on s.id = c.series_id
      left join lateral (
        select i.path from car_images i where i.car_id = c.id order by i.position limit 1
      ) cover on true
      where ${this.carsFilter(query)}
      order by c.created_at desc, c.id desc
      limit ${ADMIN_CARS_PAGE_SIZE} offset ${offset}`;

    return [...rows];
  }

  async countCars(query: AdminCarsQuery): Promise<number> {
    const [row] = await this.sql<{ total: number }[]>`
      select count(*)::int as total
      from cars c
      where ${this.carsFilter(query)}`;

    return row?.total ?? 0;
  }

  /** Один фрагмент условий на страницу и счётчик (как в admin.repository). */
  private carsFilter(query: AdminCarsQuery) {
    const q = query.q ?? null;

    return this.sql`
          (${q}::text is null or c.name ilike '%' || ${q}::text || '%' or c.slug ilike '%' || ${q}::text || '%')
      and (${query.status}::text = 'all' or c.is_published = (${query.status}::text = 'published'))`;
  }

  async findOptions(): Promise<{
    series: OptionRow[];
    bodyTypes: OptionRow[];
    fuelTypes: OptionRow[];
    colors: ColorOptionRow[];
  }> {
    const [series, bodyTypes, fuelTypes, colors] = await Promise.all([
      this.sql<OptionRow[]>`select id::int as id, name from series order by position, id`,
      this.sql<OptionRow[]>`select id::int as id, name from body_types order by position, id`,
      this.sql<OptionRow[]>`select id::int as id, name from fuel_types order by position, id`,
      this.sql<ColorOptionRow[]>`select id::int as id, name, hex from colors order by id`,
    ]);

    return {
      series: [...series],
      bodyTypes: [...bodyTypes],
      fuelTypes: [...fuelTypes],
      colors: [...colors],
    };
  }

  /**
   * Карточка для редактирования: строка cars с палитрой и числом записей
   * (`undefined` — нет такого автомобиля) и фото по position. Два запроса
   * параллельно: фото — отдельный список, склеивать его в строку незачем.
   */
  async findCar(id: number): Promise<{ car: AdminCarRow; images: AdminCarImageRow[] } | undefined> {
    const [cars, images] = await Promise.all([
      this.sql<AdminCarRow[]>`
        select c.id::int as id,
               c.name,
               c.slug,
               c.series_id::int,
               c.body_type_id::int,
               c.fuel_type_id::int,
               c.drive_type,
               c.model_year::int,
               c.description,
               c.power_hp::int,
               c.acceleration_s,
               c.top_speed_kmh::int,
               c.price,
               c.model_3d_path,
               c.paint_material,
               c.is_published,
               array(
                 select cc.color_id::int from car_colors cc
                 where cc.car_id = c.id order by cc.color_id
               ) as color_ids,
               (select count(*)::int from test_drives td where td.car_id = c.id) as test_drives_count
        from cars c
        where c.id = ${id}`,
      this.sql<AdminCarImageRow[]>`
        select id::int as id, position::int, path, alt
        from car_images
        where car_id = ${id}
        order by position`,
    ]);

    const car = cars[0];
    return car && { car, images: [...images] };
  }

  /** UC-A4: черновик вместе с палитрой. Возвращает id нового автомобиля. */
  async createCar(input: CreateAdminCar): Promise<number> {
    const { colorIds, ...fields } = input;

    return this.sql.begin(async (tx) => {
      // is_published явно: у колонки default true (так заведён seed),
      // а новый автомобиль — всегда черновик
      const values = { ...toCarValues(fields), is_published: false };
      const [row] = await tx<{ id: number }[]>`
        insert into cars ${tx(values)}
        returning id::int as id`;
      const id = row!.id;

      await this.insertColors(tx, id, colorIds);
      return id;
    });
  }

  /**
   * Переданные поля и (если есть `colorIds`) палитра целиком — в одной
   * транзакции. `false` — автомобиля нет.
   */
  async updateCar(id: number, input: UpdateAdminCar): Promise<boolean> {
    const { colorIds, ...fields } = input;
    const values = toCarValues(fields);
    const columns = Object.keys(values) as CarColumn[];

    return this.sql.begin(async (tx) => {
      const [row] =
        columns.length > 0
          ? await tx`update cars set ${tx(values, columns)} where id = ${id} returning id`
          : // меняется только палитра — строку cars не трогаем, но
            // существование проверяем и блокируем от параллельного удаления
            await tx`select id from cars where id = ${id} for update`;
      if (!row) return false;

      if (colorIds) {
        await tx`delete from car_colors where car_id = ${id}`;
        await this.insertColors(tx, id, colorIds);
      }
      return true;
    });
  }

  private async insertColors(tx: Tx, carId: number, colorIds: number[]): Promise<void> {
    if (colorIds.length === 0) return;
    await tx`
      insert into car_colors (car_id, color_id)
      select ${carId}, unnest(${colorIds}::bigint[])`;
  }

  /**
   * Блокирует строку автомобиля до конца транзакции; `undefined` — нет такого.
   *
   * Правило «у опубликованного автомобиля есть хотя бы одно фото» держат
   * две операции: публикация (нет фото → CAR_NOT_READY) и удаление фото
   * (последнее у опубликованного → LAST_IMAGE). Обе берут эту блокировку
   * первой — иначе параллельные publish и удаление последнего фото
   * проверили бы каждая «до» другой и вместе оставили бы опубликованный
   * автомобиль без фото.
   */
  async lockCar(tx: Tx, id: number): Promise<{ isPublished: boolean } | undefined> {
    const [row] = await tx<{ isPublished: boolean }[]>`
      select is_published from cars where id = ${id} for update`;
    return row;
  }

  async publishCar(id: number): Promise<PublishOutcome> {
    return this.sql.begin(async (tx): Promise<PublishOutcome> => {
      const car = await this.lockCar(tx, id);
      if (!car) return "not_found";
      if (car.isPublished) return "published";

      const [images] = await tx<{ exists: boolean }[]>`
        select exists (select 1 from car_images where car_id = ${id}) as exists`;
      if (!images?.exists) return "no_images";

      await tx`update cars set is_published = true where id = ${id}`;
      return "published";
    });
  }

  /** Снятие с публикации ничем не ограничено. `false` — автомобиля нет. */
  async unpublishCar(id: number): Promise<boolean> {
    const rows = await this.sql`
      update cars set is_published = false where id = ${id} returning id`;
    return rows.length > 0;
  }

  /**
   * Удаляет автомобиль (фото и палитра уходят каскадом) и возвращает пути
   * его файлов — фото и модели, — чтобы сервис убрал объекты из MinIO
   * после коммита. `undefined` — автомобиля нет.
   *
   * Записи на тест-драйв не проверяются отдельным select-ом: их держит FK
   * test_drives_car_fk (on delete restrict), delete падает с 23503 и
   * транзакция откатывается целиком. Проверка атомарна сама по себе —
   * запись, созданная между select-ом и delete, её не обойдёт.
   */
  async deleteCar(id: number): Promise<string[] | undefined> {
    return this.sql.begin(async (tx) => {
      // блокировка — чтобы между чтением путей и delete к автомобилю не
      // добавилось фото (загрузка берёт ту же блокировку): его файл
      // остался бы в MinIO без строки в БД
      const car = await this.lockCar(tx, id);
      if (!car) return undefined;

      const images = await tx<{ path: string }[]>`
        select path from car_images where car_id = ${id}`;
      const [deleted] = await tx<{ model3dPath: string | null }[]>`
        delete from cars where id = ${id} returning model_3d_path`;

      const paths = images.map((image) => image.path);
      if (deleted?.model3dPath) paths.push(deleted.model3dPath);
      return paths;
    });
  }

  /** UC-A5: фото в конец списка. `false` — автомобиля нет. */
  async addImage(id: number, path: string, alt: string): Promise<boolean> {
    return this.sql.begin(async (tx) => {
      // блокировка и от параллельного deleteCar (иначе объект нового фото
      // остался бы в MinIO без строки), и от параллельной загрузки —
      // две вставки посчитали бы одинаковый max(position)
      if (!(await this.lockCar(tx, id))) return false;

      await tx`
        insert into car_images (car_id, position, path, alt)
        select ${id}, coalesce(max(position), 0) + 1, ${path}, ${alt}
        from car_images
        where car_id = ${id}`;
      return true;
    });
  }

  /** Новый файл того же фото: position и alt остаются. */
  async replaceImageFile(id: number, imageId: number, path: string): Promise<ReplaceImageOutcome> {
    return this.sql.begin(async (tx): Promise<ReplaceImageOutcome> => {
      if (!(await this.lockCar(tx, id))) return "car_not_found";

      const [image] = await tx<{ path: string }[]>`
        select path from car_images
        where id = ${imageId} and car_id = ${id}
        for update`;
      if (!image) return "image_not_found";

      await tx`update car_images set path = ${path} where id = ${imageId}`;
      return { oldPath: image.path };
    });
  }

  /**
   * Одно поле одной строки — блокировка автомобиля не нужна: файлов и
   * правила про последнее фото это не касается. `false` — фото нет
   * (или оно чужого автомобиля, или нет самого автомобиля).
   */
  async updateImageAlt(id: number, imageId: number, alt: string): Promise<boolean> {
    const rows = await this.sql`
      update car_images set alt = ${alt}
      where id = ${imageId} and car_id = ${id}
      returning id`;
    return rows.length > 0;
  }

  /** `imageIds` — полный новый порядок, ровно текущие фото автомобиля. */
  async reorderImages(id: number, imageIds: number[]): Promise<ReorderImagesOutcome> {
    return this.sql.begin(async (tx): Promise<ReorderImagesOutcome> => {
      // под блокировкой набор фото не изменится между сверкой и update
      if (!(await this.lockCar(tx, id))) return "car_not_found";

      const rows = await tx<{ id: number }[]>`
        select id::int as id from car_images where car_id = ${id}`;
      // id в imageIds уникальны (контракт), поэтому равных длин и
      // вхождения каждого достаточно для совпадения наборов
      const current = new Set(rows.map((row) => row.id));
      if (current.size !== imageIds.length || !imageIds.every((imageId) => current.has(imageId))) {
        return "mismatch";
      }

      // перестановка проходит через временные дубли (car_id, position):
      // уникальность проверяется на коммите, а не после каждой строки
      await tx`set constraints car_images_car_position_uq deferred`;
      await tx`
        update car_images i set position = t.ord
        from unnest(${imageIds}::bigint[]) with ordinality as t(id, ord)
        where i.id = t.id and i.car_id = ${id}`;
      return "reordered";
    });
  }

  /**
   * Удаляет фото и сдвигает следующие на его место — позиции без дыр.
   * Последнее фото опубликованного удалить нельзя (см. lockCar).
   */
  async deleteImage(id: number, imageId: number): Promise<DeleteImageOutcome> {
    return this.sql.begin(async (tx): Promise<DeleteImageOutcome> => {
      const car = await this.lockCar(tx, id);
      if (!car) return "car_not_found";

      const [image] = await tx<{ path: string; position: number; total: number }[]>`
        select path,
               position::int,
               (select count(*)::int from car_images where car_id = ${id}) as total
        from car_images
        where id = ${imageId} and car_id = ${id}`;
      if (!image) return "image_not_found";
      if (car.isPublished && image.total === 1) return "last_image";

      await tx`delete from car_images where id = ${imageId}`;
      await tx`set constraints car_images_car_position_uq deferred`;
      await tx`
        update car_images set position = position - 1
        where car_id = ${id} and position > ${image.position}`;
      return { oldPath: image.path };
    });
  }

  /**
   * UC-A6: новая модель вместо прежней (если была). Возвращает прежний
   * путь (`null` — модели не было); `undefined` — автомобиля нет.
   */
  async setModel(
    id: number,
    path: string,
    paintMaterial: string,
  ): Promise<{ oldPath: string | null } | undefined> {
    return this.sql.begin(async (tx) => {
      if (!(await this.lockCar(tx, id))) return undefined;

      const [old] = await tx<{ model3dPath: string | null }[]>`
        select model_3d_path from cars where id = ${id}`;
      await tx`
        update cars set model_3d_path = ${path}, paint_material = ${paintMaterial}
        where id = ${id}`;
      return { oldPath: old?.model3dPath ?? null };
    });
  }

  /** Убирает модель; повтор без модели — не ошибка. `undefined` — автомобиля нет. */
  async removeModel(id: number): Promise<{ oldPath: string | null } | undefined> {
    return this.sql.begin(async (tx) => {
      if (!(await this.lockCar(tx, id))) return undefined;

      const [old] = await tx<{ model3dPath: string | null }[]>`
        select model_3d_path from cars where id = ${id}`;
      if (old?.model3dPath) {
        await tx`
          update cars set model_3d_path = null, paint_material = null
          where id = ${id}`;
      }
      return { oldPath: old?.model3dPath ?? null };
    });
  }
}
