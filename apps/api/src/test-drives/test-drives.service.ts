import { Injectable } from "@nestjs/common";
import {
  SALON_TIME_ZONE,
  type CreateTestDrive,
  type MyTestDrives,
  type SlotsResponse,
  type TestDrive,
} from "@carshowroom/contracts";
import { AppError } from "../common/app-error.js";
import {
  MAX_ACTIVE_TEST_DRIVES,
  bookingWindow,
  isCancellable,
  isOnGrid,
  isWithinBookingWindow,
  slotGrid,
  slotTimeLabel,
} from "./rules.js";
import { TestDrivesRepository, type TestDriveRow } from "./test-drives.repository.js";

// Нарушение частичного уникального индекса «у клиента одна активная запись
// на одно время» (TD-6). Индекс по (car_id, starts_at) разбирать не нужно:
// его 23505 глобальный фильтр ошибок и так переводит в 409 SLOT_TAKEN.
const USER_SLOT_INDEX = "test_drives_user_slot_uq";

function isUserSlotConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505" &&
    (error as { constraint_name?: unknown }).constraint_name === USER_SLOT_INDEX
  );
}

/**
 * Правила тест-драйва (rules.ts) и перевод строк БД в контракт.
 * Контроллер только валидирует вход и знает текущего пользователя,
 * репозиторий — только SQL.
 */
@Injectable()
export class TestDrivesService {
  constructor(private readonly repository: TestDrivesRepository) {}

  /**
   * Сетка слотов дня (UC-G4). Слоты не хранятся: 9 моментов считает
   * rules.slotGrid по поясу салона, БД отвечает только на вопрос
   * «кто уже занят» — одним запросом по всей сетке сразу.
   */
  async getSlots(slug: string, date: string, now = new Date()): Promise<SlotsResponse> {
    const carId = await this.repository.findPublishedCarIdBySlug(slug);
    if (!carId) throw new AppError("NOT_FOUND", "Автомобиль не найден", { slug });

    const grid = slotGrid(date);
    const taken = await this.repository.findTakenSlots(carId, grid[0]!, grid.at(-1)!);
    const takenTimes = new Set(taken.map((instant) => instant.getTime()));

    return {
      date,
      timeZone: SALON_TIME_ZONE,
      slots: grid.map((instant) => {
        const free = !takenTimes.has(instant.getTime());
        return {
          startsAt: instant.toISOString(),
          time: slotTimeLabel(instant),
          free,
          bookable: free && isWithinBookingWindow(instant, now),
        };
      }),
    };
  }

  /** UC-U4: свои записи двумя вкладками. Предстоящее — ближайшее сверху. */
  async getMyTestDrives(userId: string, now = new Date()): Promise<MyTestDrives> {
    const rows = await this.repository.findAllForUser(userId);

    const upcoming = rows.filter(
      (row) => row.status === "scheduled" && row.startsAt.getTime() > now.getTime(),
    );
    const history = rows.filter((row) => !upcoming.includes(row));

    return {
      upcoming: upcoming.reverse().map((row) => toTestDrive(row, now)),
      history: history.map((row) => toTestDrive(row, now)),
    };
  }

  /** UC-U3: запись на тест-драйв. Порядок проверок — от входных данных к БД. */
  async create(userId: string, input: CreateTestDrive, now = new Date()): Promise<TestDrive> {
    const startsAt = new Date(input.startsAt);

    if (!isOnGrid(startsAt)) {
      throw new AppError("SLOT_NOT_ON_GRID", "Время не совпадает с сеткой слотов", {
        startsAt: input.startsAt,
      });
    }

    if (!isWithinBookingWindow(startsAt, now)) {
      const { from, to } = bookingWindow(now);
      throw new AppError("SLOT_OUT_OF_RANGE", "Записаться на это время уже (или ещё) нельзя", {
        from: from.toISOString(),
        to: to.toISOString(),
      });
    }

    const carId = await this.repository.findPublishedCarId(input.carId);
    if (!carId) throw new AppError("NOT_FOUND", "Автомобиль не найден", { carId: input.carId });

    // Лимит TD-6 — обычная проверка счётчиком: гонки тут нет, две
    // параллельные записи в худшем случае дадут третью активную.
    const active = await this.repository.countActiveUpcoming(userId, now);
    if (active >= MAX_ACTIVE_TEST_DRIVES) {
      throw new AppError(
        "TOO_MANY_ACTIVE",
        `Одновременно можно держать не больше ${MAX_ACTIVE_TEST_DRIVES} записей`,
        { active, limit: MAX_ACTIVE_TEST_DRIVES },
      );
    }

    try {
      // Занятость слота заранее не проверяется (docs/db/README.md):
      // 23505 от test_drives_car_slot_uq превращает в 409 SLOT_TAKEN
      // глобальный фильтр ошибок.
      const row = await this.repository.insert({
        userId,
        carId,
        startsAt,
        phone: input.phone,
        comment: input.comment ?? null,
      });

      return toTestDrive(row, now);
    } catch (error) {
      if (isUserSlotConflict(error)) {
        throw new AppError("TOO_MANY_ACTIVE", "У вас уже есть запись на это время", {
          startsAt: input.startsAt,
        });
      }
      throw error;
    }
  }

  /** UC-U4: отмена своей будущей записи (TD-7). */
  async cancel(userId: string, id: number, now = new Date()): Promise<TestDrive> {
    const row = await this.repository.findByIdForUser(id, userId);
    // чужая запись не находится — 404, а не 403: существование чужой
    // записи не подсказываем
    if (!row) throw new AppError("NOT_FOUND", "Запись не найдена", { id });

    if (row.status !== "scheduled") {
      throw new AppError("ALREADY_CLOSED", "Запись уже закрыта", { status: row.status });
    }

    if (row.startsAt.getTime() <= now.getTime()) {
      throw new AppError("TOO_LATE_TO_CANCEL", "Слот уже начался — отменить нельзя", {
        startsAt: row.startsAt.toISOString(),
      });
    }

    const cancelled = await this.repository.cancelByUser(id, userId);
    // статус успел измениться между чтением и update — закрыл менеджер
    if (!cancelled) throw new AppError("ALREADY_CLOSED", "Запись уже закрыта", { id });

    return toTestDrive({ ...row, status: "cancelled" }, now);
  }
}

function toTestDrive(row: TestDriveRow, now: Date): TestDrive {
  return {
    id: row.id,
    car: {
      id: row.carId,
      slug: row.carSlug,
      name: row.carName,
      coverPath: row.coverPath,
      coverAlt: row.coverAlt,
    },
    startsAt: row.startsAt.toISOString(),
    status: row.status,
    phone: row.phone,
    comment: row.comment,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt.toISOString(),
    cancellable: isCancellable(row.status, row.startsAt, now),
  };
}
