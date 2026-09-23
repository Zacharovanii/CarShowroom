import { Inject, Injectable } from "@nestjs/common";
import type { TestDriveStatus } from "@carshowroom/contracts";
import { SQL, type Sql } from "../db/db.module.js";

// Типы строк SQL (не типы ответа API — те только в contracts). Имена уже
// camelCase: DatabaseModule включает transform: postgres.camel.
//
// timestamptz postgres.js отдаёт объектом Date — сервис считает по нему
// правила и сам переводит его в строку контракта.

export interface CarSlotRow {
  id: number;
  startsAt: Date;
}

export interface TestDriveRow {
  id: number;
  userId: string;
  carId: number;
  startsAt: Date;
  phone: string;
  comment: string | null;
  status: TestDriveStatus;
  cancelReason: string | null;
  createdAt: Date;
  carSlug: string;
  carName: string;
  coverPath: string | null;
  coverAlt: string | null;
}

@Injectable()
export class TestDrivesRepository {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /** Опубликованный автомобиль по slug — id для сетки слотов. */
  async findPublishedCarIdBySlug(slug: string): Promise<number | undefined> {
    const rows = await this.sql<{ id: number }[]>`
      select id::int as id from catalog_items where slug = ${slug}`;

    return rows[0]?.id;
  }

  /** Он же по id — проверка «на что записываемся» при создании записи. */
  async findPublishedCarId(carId: number): Promise<number | undefined> {
    const rows = await this.sql<{ id: number }[]>`
      select id::int as id from catalog_items where id = ${carId}`;

    return rows[0]?.id;
  }

  /**
   * Занятые слоты автомобиля внутри диапазона. Границы приходят готовыми
   * моментами (их считает сетка по поясу салона), поэтому сравнение идёт
   * по timestamptz и никак не зависит от пояса сессии Postgres.
   */
  async findTakenSlots(carId: number, from: Date, to: Date): Promise<Date[]> {
    const rows = await this.sql<{ startsAt: Date }[]>`
      select starts_at
      from test_drives
      where car_id = ${carId}
        and status = 'scheduled'
        and starts_at between ${from} and ${to}`;

    return rows.map((row) => row.startsAt);
  }

  /** Сколько у клиента активных будущих записей — лимит TD-6. */
  async countActiveUpcoming(userId: string, now: Date): Promise<number> {
    const [row] = await this.sql<{ total: number }[]>`
      select count(*)::int as total
      from test_drives
      where user_id = ${userId} and status = 'scheduled' and starts_at > ${now}`;

    return row?.total ?? 0;
  }

  /**
   * Вставка записи. Занятость слота заранее не проверяется: её держат
   * частичные уникальные индексы test_drives_car_slot_uq и
   * test_drives_user_slot_uq, а 23505 разбирает вызывающий код.
   */
  async insert(input: {
    userId: string;
    carId: number;
    startsAt: Date;
    phone: string;
    comment: string | null;
  }): Promise<TestDriveRow> {
    const [row] = await this.sql<{ id: number }[]>`
      insert into test_drives (user_id, car_id, starts_at, phone, comment)
      values (${input.userId}, ${input.carId}, ${input.startsAt}, ${input.phone}, ${input.comment})
      returning id::int as id`;

    // Строка нужна целиком, вместе с данными автомобиля, поэтому сразу
    // перечитываем её тем же запросом, что и «Мои записи» — один формат
    // ответа вместо двух.
    return (await this.findByIdForUser(row!.id, input.userId))!;
  }

  /** Все записи клиента: и предстоящие, и история — делит их сервис. */
  async findAllForUser(userId: string): Promise<TestDriveRow[]> {
    const rows = await this.sql<TestDriveRow[]>`
      ${this.testDriveSelect()}
      where td.user_id = ${userId}
      order by td.starts_at desc`;

    return [...rows];
  }

  /**
   * Запись клиента по id. Чужая запись не находится вовсе: сервису нужен
   * именно 404, а не 403 — существование чужой записи не подсказываем.
   */
  async findByIdForUser(id: number, userId: string): Promise<TestDriveRow | undefined> {
    const rows = await this.sql<TestDriveRow[]>`
      ${this.testDriveSelect()}
      where td.id = ${id} and td.user_id = ${userId}`;

    return rows[0];
  }

  /**
   * Отмена клиентом: статус меняется только из scheduled. Условие по статусу
   * стоит в самом update — между чтением записи и записью нового статуса
   * её мог закрыть менеджер. Пустой результат значит «уже закрыта».
   */
  async cancelByUser(id: number, userId: string): Promise<boolean> {
    const rows = await this.sql`
      update test_drives
      set status = 'cancelled', closed_at = now(), closed_by = ${userId}
      where id = ${id} and user_id = ${userId} and status = 'scheduled'
      returning id`;

    return rows.length > 0;
  }

  /** Общая часть выборки записей клиента: запись + подпись автомобиля. */
  private testDriveSelect() {
    return this.sql`
      select td.id::int as id,
             td.user_id,
             td.car_id::int as car_id,
             td.starts_at,
             td.phone,
             td.comment,
             td.status,
             td.cancel_reason,
             td.created_at,
             c.slug as car_slug,
             c.name as car_name,
             img.path as cover_path,
             img.alt  as cover_alt
      from test_drives td
      join cars c on c.id = td.car_id
      left join car_images img on img.car_id = c.id and img.position = 1`;
  }
}
