import { z } from "zod";
import { moneySchema } from "./common.js";

export const driveTypes = ["rwd", "xdrive"] as const;
export const carSorts = ["price-asc", "price-desc", "newest"] as const;

export type DriveType = (typeof driveTypes)[number];
export type CarSort = (typeof carSorts)[number];

/**
 * Размер страницы каталога — константа, а не параметр запроса: в каталоге
 * десяток автомобилей, выбирать размер страницы некому (UC-G2).
 */
export const CARS_PAGE_SIZE = 6;

// ---------------------------------------------------------------------
// GET /api/catalog/filters
// ---------------------------------------------------------------------

/** Строка справочника: `id` уходит в URL фильтра, `position` задаёт порядок. */
export const filterOptionSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  position: z.number().int().nonnegative(),
});

export const catalogFiltersSchema = z.object({
  series: z.array(filterOptionSchema),
  bodyTypes: z.array(filterOptionSchema),
  fuelTypes: z.array(filterOptionSchema),
});

export type FilterOption = z.infer<typeof filterOptionSchema>;
export type CatalogFilters = z.infer<typeof catalogFiltersSchema>;

// ---------------------------------------------------------------------
// GET /api/cars
// ---------------------------------------------------------------------

export const carsQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  series: z.coerce.number().int().positive().optional(),
  body: z.coerce.number().int().positive().optional(),
  fuel: z.coerce.number().int().positive().optional(),
  drive: z.enum(driveTypes).optional(),
  priceMin: moneySchema.optional(),
  priceMax: moneySchema.optional(),
  sort: z.enum(carSorts).default("newest"),
  page: z.coerce.number().int().positive().default(1),
});

export type CarsQuery = z.infer<typeof carsQuerySchema>;

/** Карточка каталога — ровно то, что показывает список (UC-G2). */
export const carCardSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  name: z.string(),
  modelYear: z.number().int(),
  price: moneySchema,
  driveType: z.enum(driveTypes),
  powerHp: z.number().int(),
  seriesName: z.string(),
  bodyTypeName: z.string(),
  fuelTypeName: z.string(),
  // обложка — фото с position = 1; у автомобиля без фото её нет
  coverPath: z.string().nullable(),
  coverAlt: z.string().nullable(),
  has3d: z.boolean(),
});

export const carsResponseSchema = z.object({
  items: z.array(carCardSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type CarCard = z.infer<typeof carCardSchema>;
export type CarsResponse = z.infer<typeof carsResponseSchema>;

// ---------------------------------------------------------------------
// GET /api/cars/:slug
// ---------------------------------------------------------------------

export const carImageSchema = z.object({
  path: z.string(),
  alt: z.string(),
});

export const carColorSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  hex: z.string(),
});

export const carDetailsSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  name: z.string(),
  modelYear: z.number().int(),
  description: z.string(),
  price: moneySchema,
  seriesName: z.string(),
  bodyTypeName: z.string(),
  fuelTypeName: z.string(),
  driveType: z.enum(driveTypes),
  powerHp: z.number().int(),
  // разгон 0–100 км/ч в секундах: numeric в БД, значит строка на проводе
  accelerationS: z.string(),
  topSpeedKmh: z.number().int(),
  images: z.array(carImageSchema),
  colors: z.array(carColorSchema),
  // путь к GLB и имя материала краски есть только вместе (CHECK в схеме)
  model3dPath: z.string().nullable(),
  paintMaterial: z.string().nullable(),
});

export type CarImage = z.infer<typeof carImageSchema>;
export type CarColor = z.infer<typeof carColorSchema>;
export type CarDetails = z.infer<typeof carDetailsSchema>;
