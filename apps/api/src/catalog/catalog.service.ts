import { Injectable } from "@nestjs/common";
import {
  CARS_PAGE_SIZE,
  type CarDetails,
  type CarsQuery,
  type CarsResponse,
  type CatalogFilters,
} from "@carshowroom/contracts";
import { AppError } from "../common/app-error.js";
import {
  CatalogRepository,
  type CarCardRow,
  type CarColorRow,
  type CarImageRow,
  type CarRow,
} from "./catalog.repository.js";

/**
 * Правила каталога и перевод строк БД в контракт. Контроллер только
 * валидирует вход, репозиторий — только SQL.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  async getFilters(): Promise<CatalogFilters> {
    return this.repository.findFilterOptions();
  }

  async getCars(query: CarsQuery): Promise<CarsResponse> {
    const [rows, total] = await Promise.all([
      this.repository.findCars(query),
      this.repository.countCars(query),
    ]);

    return {
      items: rows.map(toCard),
      page: query.page,
      pageSize: CARS_PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / CARS_PAGE_SIZE),
    };
  }

  async getCarBySlug(slug: string): Promise<CarDetails> {
    const car = await this.repository.findCarBySlug(slug);
    // представление catalog_items отбирает только опубликованные, поэтому
    // «снят с публикации» и «нет такого slug» здесь одинаковы — так и надо
    // (UC-G3: «Автомобиль не найден»)
    if (!car) throw new AppError("NOT_FOUND", "Автомобиль не найден", { slug });

    const [images, colors] = await Promise.all([
      this.repository.findCarImages(car.id),
      this.repository.findCarColors(car.id),
    ]);

    return toDetails(car, images, colors);
  }
}

function toCard(row: CarCardRow): CarsResponse["items"][number] {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    modelYear: row.modelYear,
    price: row.price,
    driveType: row.driveType,
    powerHp: row.powerHp,
    seriesName: row.seriesName,
    bodyTypeName: row.bodyTypeName,
    fuelTypeName: row.fuelTypeName,
    coverPath: row.coverPath,
    coverAlt: row.coverAlt,
    has3d: row.has3d,
  };
}

function toDetails(row: CarRow, images: CarImageRow[], colors: CarColorRow[]): CarDetails {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    modelYear: row.modelYear,
    description: row.description,
    price: row.price,
    seriesName: row.seriesName,
    bodyTypeName: row.bodyTypeName,
    fuelTypeName: row.fuelTypeName,
    driveType: row.driveType,
    powerHp: row.powerHp,
    accelerationS: row.accelerationS,
    topSpeedKmh: row.topSpeedKmh,
    images: images.map((image) => ({ path: image.path, alt: image.alt })),
    colors: colors.map((color) => ({ id: color.id, name: color.name, hex: color.hex })),
    model3dPath: row.model3dPath,
    paintMaterial: row.paintMaterial,
  };
}
