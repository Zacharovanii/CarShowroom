import { Inject, Injectable } from "@nestjs/common";
import { USERS_PAGE_SIZE, type UserRole, type UsersQuery } from "@carshowroom/contracts";
import { SQL, type Sql } from "../db/db.module.js";

// Тип строки SQL (не тип ответа API — тот только в contracts). Имена уже
// camelCase: DatabaseModule включает transform: postgres.camel.

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: Date;
}

@Injectable()
export class AdminRepository {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /**
   * Страница списка пользователей (UC-A1). Список читается своим SQL,
   * а не listUsers admin-плагина: инвариант проекта — запросы пишутся
   * руками, а плагин нужен только там, где он заводит пароль (создание).
   */
  async findUsers(query: UsersQuery): Promise<UserRow[]> {
    const offset = (query.page - 1) * USERS_PAGE_SIZE;

    const rows = await this.sql<UserRow[]>`
      select id, name, email, phone, role, created_at
      from users
      where ${this.usersFilter(query)}
      order by created_at desc, id
      limit ${USERS_PAGE_SIZE} offset ${offset}`;

    return [...rows];
  }

  /** Сколько всего пользователей подходит под фильтры — для пагинации. */
  async countUsers(query: UsersQuery): Promise<number> {
    const [row] = await this.sql<{ total: number }[]>`
      select count(*)::int as total
      from users
      where ${this.usersFilter(query)}`;

    return row?.total ?? 0;
  }

  /**
   * Условия отбора — один фрагмент на два запроса (страница и счётчик),
   * чтобы они не разъехались. Незаданный параметр даёт истинное условие:
   * запрос остаётся статичным текстом с плейсхолдерами (как в каталоге).
   */
  private usersFilter(query: UsersQuery) {
    const q = query.q ?? null;
    const role = query.role ?? null;

    return this.sql`
          (${q}::text is null or name ilike '%' || ${q}::text || '%' or email ilike '%' || ${q}::text || '%')
      and (${role}::text is null or role = ${role}::text)`;
  }
}
