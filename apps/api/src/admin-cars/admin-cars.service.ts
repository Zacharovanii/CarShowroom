import { Injectable, Logger } from "@nestjs/common";
import {
  ADMIN_CARS_PAGE_SIZE,
  type AdminCar,
  type AdminCarListItem,
  type AdminCarOptions,
  type AdminCarsQuery,
  type AdminCarsResponse,
  type CreateAdminCar,
  type ErrorCode,
  type UpdateAdminCar,
} from "@carshowroom/contracts";
import { AppError } from "../common/app-error.js";
import { StorageService } from "../storage/storage.service.js";
import { isMediaPath, keyFromMediaPath } from "../storage/media-path.js";
import {
  AdminCarsRepository,
  type AdminCarImageRow,
  type AdminCarListRow,
  type AdminCarRow,
} from "./admin-cars.repository.js";

// Ошибка postgres.js: `code` — код Postgres, `constraint_name` — имя
// нарушенного ограничения (документированные поля, как в test-drives).
function pgConstraint(error: unknown, code: string): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { code: actual, constraint_name: name } = error as {
    code?: unknown;
    constraint_name?: unknown;
  };
  return actual === code && typeof name === "string" ? name : undefined;
}

// 23505 переводится здесь, а не в глобальном фильтре: тот любую
// unique_violation считает занятым слотом тест-драйва (SLOT_TAKEN).
const UNIQUE_VIOLATIONS: Record<string, { code: ErrorCode; message: string; field: string }> = {
  cars_slug_uq: { code: "SLUG_TAKEN", message: "Этот slug уже занят", field: "slug" },
  cars_name_uq: {
    code: "NAME_TAKEN",
    message: "Автомобиль с таким названием уже есть",
    field: "name",
  },
};

// 23503 на insert/update: id справочника или цвета, которого нет в БД.
// Контракт проверяет только форму id, существование — дело FK.
const MISSING_REFERENCES: Record<string, { field: string; message: string }> = {
  cars_series_fk: { field: "seriesId", message: "Такой серии нет" },
  cars_body_type_fk: { field: "bodyTypeId", message: "Такого типа кузова нет" },
  cars_fuel_type_fk: { field: "fuelTypeId", message: "Такого типа двигателя нет" },
  car_colors_color_fk: { field: "colorIds", message: "Такого цвета нет" },
};

/** Ошибка записи полей карточки → AppError; неизвестные — как есть. */
function toFieldError(error: unknown): unknown {
  const unique = UNIQUE_VIOLATIONS[pgConstraint(error, "23505") ?? ""];
  if (unique) return new AppError(unique.code, unique.message, { field: unique.field });

  const missing = MISSING_REFERENCES[pgConstraint(error, "23503") ?? ""];
  if (missing) {
    return new AppError("VALIDATION_FAILED", missing.message, { field: missing.field });
  }

  return error;
}

function notFound(id: number): AppError {
  return new AppError("NOT_FOUND", "Автомобиль не найден", { id });
}

/**
 * Карточки автомобилей в админке (UC-A3, UC-A4, D26). Роль проверяет
 * guard на контроллере. Мутации возвращают полную карточку — её читает
 * getCar после коммита, отдельным запросом.
 */
@Injectable()
export class AdminCarsService {
  private readonly logger = new Logger(AdminCarsService.name);

  constructor(
    private readonly repository: AdminCarsRepository,
    private readonly storage: StorageService,
  ) {}

  /** UC-A3: список вместе с черновиками — поиск, статус, пагинация. */
  async getCars(query: AdminCarsQuery): Promise<AdminCarsResponse> {
    const [rows, total] = await Promise.all([
      this.repository.findCars(query),
      this.repository.countCars(query),
    ]);

    return {
      items: rows.map(toListItem),
      page: query.page,
      pageSize: ADMIN_CARS_PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / ADMIN_CARS_PAGE_SIZE),
    };
  }

  /** Справочники формы карточки. */
  getOptions(): Promise<AdminCarOptions> {
    return this.repository.findOptions();
  }

  /** Карточка для редактирования; нет автомобиля — 404. */
  async getCar(id: number): Promise<AdminCar> {
    const found = await this.repository.findCar(id);
    if (!found) throw notFound(id);
    return toAdminCar(found.car, found.images);
  }

  /** UC-A4: новый автомобиль — всегда черновик. */
  async createCar(input: CreateAdminCar): Promise<AdminCar> {
    let id: number;
    try {
      id = await this.repository.createCar(input);
    } catch (error) {
      throw toFieldError(error);
    }
    return this.getCar(id);
  }

  /** Только переданные поля; `colorIds` заменяет палитру целиком. */
  async updateCar(id: number, input: UpdateAdminCar): Promise<AdminCar> {
    let found: boolean;
    try {
      found = await this.repository.updateCar(id, input);
    } catch (error) {
      throw toFieldError(error);
    }
    if (!found) throw notFound(id);
    return this.getCar(id);
  }

  /** Без фото публиковать нельзя: карточка каталога осталась бы без обложки. */
  async publishCar(id: number): Promise<AdminCar> {
    const outcome = await this.repository.publishCar(id);
    if (outcome === "not_found") throw notFound(id);
    if (outcome === "no_images") {
      throw new AppError("CAR_NOT_READY", "Добавьте хотя бы одно фото", { id });
    }
    return this.getCar(id);
  }

  async unpublishCar(id: number): Promise<AdminCar> {
    if (!(await this.repository.unpublishCar(id))) throw notFound(id);
    return this.getCar(id);
  }

  /**
   * Удаление вместе с файлами. Объекты MinIO удаляются только после
   * коммита: при откате (например, есть записи на тест-драйв) файлы
   * должны остаться на месте вместе со строками.
   */
  async deleteCar(id: number): Promise<void> {
    let paths: string[] | undefined;
    try {
      paths = await this.repository.deleteCar(id);
    } catch (error) {
      if (pgConstraint(error, "23503") === "test_drives_car_fk") {
        throw new AppError(
          "CAR_HAS_TEST_DRIVES",
          "Есть записи на тест-драйв — снимите автомобиль с публикации",
          { id },
        );
      }
      throw error;
    }
    if (!paths) throw notFound(id);

    await this.deleteMediaObjects(paths);
  }

  /**
   * Убирает из MinIO объекты по путям из БД — после коммита транзакции,
   * которая эти пути отвязала. `/assets/...` (seed, заглушки) пропускаются:
   * это файлы репозитория, не хранилища. Ошибка хранилища запрос не роняет —
   * строки в БД уже нет, осиротевший объект только пишется в лог.
   */
  async deleteMediaObjects(paths: readonly string[]): Promise<void> {
    const keys = paths.filter(isMediaPath).map((path) => keyFromMediaPath(path)!);

    const results = await Promise.allSettled(keys.map((key) => this.storage.delete(key)));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        this.logger.warn(`Не удалось удалить объект ${keys[index]}: ${String(result.reason)}`);
      }
    });
  }
}

function toListItem(row: AdminCarListRow): AdminCarListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    modelYear: row.modelYear,
    price: row.price,
    seriesName: row.seriesName,
    coverPath: row.coverPath,
    isPublished: row.isPublished,
    has3d: row.has3d,
  };
}

function toAdminCar(row: AdminCarRow, images: AdminCarImageRow[]): AdminCar {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    seriesId: row.seriesId,
    bodyTypeId: row.bodyTypeId,
    fuelTypeId: row.fuelTypeId,
    driveType: row.driveType,
    modelYear: row.modelYear,
    description: row.description,
    powerHp: row.powerHp,
    accelerationS: row.accelerationS,
    topSpeedKmh: row.topSpeedKmh,
    price: row.price,
    colorIds: row.colorIds,
    images: images.map((image) => ({
      id: image.id,
      position: image.position,
      path: image.path,
      alt: image.alt,
    })),
    // CHECK cars_model_3d_ck: путь и материал заданы только вместе
    model:
      row.model3dPath && row.paintMaterial
        ? { path: row.model3dPath, paintMaterial: row.paintMaterial }
        : null,
    isPublished: row.isPublished,
    testDrivesCount: row.testDrivesCount,
  };
}
