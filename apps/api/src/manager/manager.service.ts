import { Injectable } from "@nestjs/common";
import {
  SALON_TIME_ZONE,
  type CloseTestDrive,
  type ManagerTestDrive,
  type ManagerTestDrives,
  type ManagerTestDrivesQuery,
} from "@carshowroom/contracts";
import { AppError } from "../common/app-error.js";
import { isClosed, salonDayRange, slotTimeLabel } from "../test-drives/rules.js";
import { ManagerRepository, type ManagerTestDriveRow } from "./manager.repository.js";

/**
 * Рабочий день менеджера (UC-M1, UC-M2). Роль здесь не проверяется —
 * это дело guard-а на контроллере; сервис знает только правила TD-9
 * и перевод строк БД в контракт.
 */
@Injectable()
export class ManagerService {
  constructor(private readonly repository: ManagerRepository) {}

  /** UC-M1: записи выбранного дня, по времени сверху вниз. */
  async getDay(query: ManagerTestDrivesQuery, now = new Date()): Promise<ManagerTestDrives> {
    const { from, to } = salonDayRange(query.date);
    const rows = await this.repository.findByDay(
      from,
      to,
      query.carId ?? null,
      query.status ?? null,
    );

    return {
      date: query.date,
      timeZone: SALON_TIME_ZONE,
      items: rows.map((row) => toManagerTestDrive(row, now)),
    };
  }

  /**
   * UC-M2: закрытие записи. Статус меняется один раз, из scheduled
   * в конечный, и только в ту сторону, которая согласуется со временем
   * слота: результат визита — после его начала, отмена — до.
   */
  async close(
    managerId: string,
    id: number,
    input: CloseTestDrive,
    now = new Date(),
  ): Promise<ManagerTestDrive> {
    const row = await this.repository.findById(id);
    if (!row) throw new AppError("NOT_FOUND", "Запись не найдена", { id });

    if (isClosed(row.status)) {
      throw new AppError("ALREADY_CLOSED", "Запись уже закрыта", { status: row.status });
    }

    const started = row.startsAt.getTime() <= now.getTime();

    if (input.status === "cancelled" && started) {
      throw new AppError("TOO_LATE_TO_CANCEL", "Слот уже начался — отменить нельзя", {
        startsAt: row.startsAt.toISOString(),
      });
    }

    if (input.status !== "cancelled" && !started) {
      throw new AppError("SLOT_NOT_STARTED", "Слот ещё не начался — результата визита нет", {
        startsAt: row.startsAt.toISOString(),
      });
    }

    const cancelReason = input.status === "cancelled" ? input.cancelReason : null;

    // «Ещё открыта» проверяет сам update: между чтением выше и записью
    // её мог закрыть другой сотрудник или клиент своей отменой.
    const closed = await this.repository.close(id, input.status, managerId, cancelReason);
    if (!closed) throw new AppError("ALREADY_CLOSED", "Запись уже закрыта", { id });

    return toManagerTestDrive({ ...row, status: input.status, cancelReason }, now);
  }
}

function toManagerTestDrive(row: ManagerTestDriveRow, now: Date): ManagerTestDrive {
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
    time: slotTimeLabel(row.startsAt),
    status: row.status,
    client: {
      name: row.clientName,
      email: row.clientEmail,
      phone: row.clientPhone,
    },
    phone: row.phone,
    comment: row.comment,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt.toISOString(),
    started: row.startsAt.getTime() <= now.getTime(),
  };
}
