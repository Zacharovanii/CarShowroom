import { Inject, Injectable } from "@nestjs/common";
import type { TestDriveStatus } from "@carshowroom/contracts";
import { SQL, type Sql } from "../db/db.module.js";

// Типы строк SQL (не типы ответа API — те только в contracts). Имена уже
// camelCase: DatabaseModule включает transform: postgres.camel.

export interface ManagerTestDriveRow {
  id: number;
  startsAt: Date;
  phone: string;
  comment: string | null;
  status: TestDriveStatus;
  cancelReason: string | null;
  createdAt: Date;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  carId: number;
  carSlug: string;
  carName: string;
  coverPath: string | null;
  coverAlt: string | null;
}

@Injectable()
export class ManagerRepository {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * Записи одного дня (UC-M1). Границы суток приходят готовыми моментами —
   * их считает rules.salonDayRange по поясу салона, поэтому выборка
   * не зависит от пояса сессии Postgres.
   *
   * Фильтры необязательные и собираются по схеме «параметр не задан —
   * условие истинно»: запрос остаётся одним статичным текстом
   * с плейсхолдерами, как в каталоге.
   */
  async findByDay(
    from: Date,
    to: Date,
    carId: number | null,
    status: TestDriveStatus | null,
  ): Promise<ManagerTestDriveRow[]> {
    const rows = await this.sql<ManagerTestDriveRow[]>`
      ${this.testDriveSelect()}
      where td.starts_at >= ${from}
        and td.starts_at < ${to}
        and (${carId}::bigint is null or td.car_id = ${carId}::bigint)
        and (${status}::text is null or td.status = ${status}::text)
      order by td.starts_at, td.id`;

    return [...rows];
  }

  /** Запись по id — без привязки к клиенту: менеджер видит все. */
  async findById(id: number): Promise<ManagerTestDriveRow | undefined> {
    const rows = await this.sql<ManagerTestDriveRow[]>`
      ${this.testDriveSelect()}
      where td.id = ${id}`;

    return rows[0];
  }

  /**
   * Закрытие записи сотрудником (TD-9). Условие «ещё открыта» стоит
   * в самом update: между чтением записи и записью статуса её мог закрыть
   * другой сотрудник или сам клиент. Пустой результат значит «уже закрыта».
   *
   * closed_at и closed_by проставляются вместе со статусом — этого требует
   * CHECK test_drives_closed_ck.
   */
  async close(
    id: number,
    status: TestDriveStatus,
    closedBy: string,
    cancelReason: string | null,
  ): Promise<boolean> {
    const rows = await this.sql`
      update test_drives
      set status = ${status},
          closed_at = now(),
          closed_by = ${closedBy},
          cancel_reason = ${cancelReason}
      where id = ${id} and status = 'scheduled'
      returning id`;

    return rows.length > 0;
  }

  /** Общая часть выборки: запись + клиент + подпись автомобиля. */
  private testDriveSelect() {
    return this.sql`
      select td.id::int as id,
             td.starts_at,
             td.phone,
             td.comment,
             td.status,
             td.cancel_reason,
             td.created_at,
             u.name  as client_name,
             u.email as client_email,
             u.phone as client_phone,
             c.id::int as car_id,
             c.slug  as car_slug,
             c.name  as car_name,
             img.path as cover_path,
             img.alt  as cover_alt
      from test_drives td
      join users u on u.id = td.user_id
      join cars c on c.id = td.car_id
      left join car_images img on img.car_id = c.id and img.position = 1`;
  }
}
