import { z } from "zod";
import { driveTypes } from "./catalog.js";
import { moneySchema } from "./common.js";

/**
 * Управление каталогом из админки (D26, UC-A3…A6). Ограничения полей
 * повторяют CHECK и типы колонок `cars` (db/schema.sql): невалидное
 * значение должно вернуться 400 с сообщением у поля, а не упасть в БД.
 */

/** Размер страницы списка автомобилей — как у пользователей. */
export const ADMIN_CARS_PAGE_SIZE = 20;

export const adminCarStatuses = ["all", "published", "draft"] as const;

export type AdminCarStatus = (typeof adminCarStatuses)[number];

/** Верхняя граница `smallint` — тип колонок power_hp и top_speed_kmh. */
const SMALLINT_MAX = 32767;

const idSchema = z.number().int().positive();

/** Список уникальных id — один цвет или одно фото дважды не имеют смысла. */
function uniqueIds(message: string) {
  return z.array(idSchema).refine((ids) => new Set(ids).size === ids.length, message);
}

// ---------------------------------------------------------------------
// GET /api/admin/cars?q=&status=&page=
// ---------------------------------------------------------------------

export const adminCarsQuerySchema = z.object({
  /** Поиск по названию и slug (UC-A3). */
  q: z.string().trim().min(1).optional(),
  status: z.enum(adminCarStatuses).default("all"),
  page: z.coerce.number().int().positive().default(1),
});

export type AdminCarsQuery = z.infer<typeof adminCarsQuerySchema>;

/** Строка таблицы — ровно колонки UC-A3 п.1. */
export const adminCarListItemSchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: z.string(),
  modelYear: z.number().int(),
  price: moneySchema,
  seriesName: z.string(),
  // обложка — фото с position = 1; у черновика фото может не быть
  coverPath: z.string().nullable(),
  isPublished: z.boolean(),
  has3d: z.boolean(),
});

export const adminCarsResponseSchema = z.object({
  items: z.array(adminCarListItemSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type AdminCarListItem = z.infer<typeof adminCarListItemSchema>;
export type AdminCarsResponse = z.infer<typeof adminCarsResponseSchema>;

// ---------------------------------------------------------------------
// GET /api/admin/cars/options
// ---------------------------------------------------------------------

export const adminCarOptionSchema = z.object({
  id: idSchema,
  name: z.string(),
});

export const adminCarColorOptionSchema = z.object({
  id: idSchema,
  name: z.string(),
  hex: z.string(),
});

export const adminCarOptionsSchema = z.object({
  series: z.array(adminCarOptionSchema),
  bodyTypes: z.array(adminCarOptionSchema),
  fuelTypes: z.array(adminCarOptionSchema),
  colors: z.array(adminCarColorOptionSchema),
});

export type AdminCarOption = z.infer<typeof adminCarOptionSchema>;
export type AdminCarColorOption = z.infer<typeof adminCarColorOptionSchema>;
export type AdminCarOptions = z.infer<typeof adminCarOptionsSchema>;

// ---------------------------------------------------------------------
// POST /api/admin/cars, PATCH /api/admin/cars/:id
// ---------------------------------------------------------------------

const adminCarFieldsSchema = z.object({
  name: z.string().trim().min(1, "укажите название").max(100, "название не длиннее 100 символов"),
  // тот же шаблон, что CHECK cars_slug_ck: slug уходит в URL /catalog/:slug
  slug: z
    .string()
    .trim()
    .max(100, "slug не длиннее 100 символов")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug — латиница в нижнем регистре, цифры и дефисы"),
  seriesId: idSchema,
  bodyTypeId: idSchema,
  fuelTypeId: idSchema,
  driveType: z.enum(driveTypes),
  modelYear: z
    .number()
    .int("год — целое число")
    .min(2000, "год не раньше 2000")
    .max(2100, "год не позже 2100"),
  description: z
    .string()
    .trim()
    .min(1, "укажите описание")
    .max(5000, "описание не длиннее 5000 символов"),
  powerHp: z
    .number()
    .int("мощность — целое число")
    .positive("мощность больше нуля")
    .max(SMALLINT_MAX, "слишком большая мощность"),
  // numeric(3,1): не больше двух цифр до точки и одной после
  accelerationS: z
    .string()
    .regex(/^\d{1,2}(\.\d)?$/, "разгон — число вида 4.9")
    .refine((v) => Number(v) > 0, "разгон больше нуля"),
  topSpeedKmh: z
    .number()
    .int("скорость — целое число")
    .positive("скорость больше нуля")
    .max(SMALLINT_MAX, "слишком большая скорость"),
  // numeric(12,2): не больше 10 цифр до точки; в фильтре каталога 0 допустим,
  // у карточки — нет (CHECK cars_price_ck)
  price: moneySchema
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "цена не больше 10 цифр до точки")
    .refine((v) => Number(v) > 0, "цена больше нуля"),
  // Пустая палитра допустима: цвета нужны только 3D-просмотру, а черновик
  // без модели создаётся раньше, чем к нему что-то привязано. В seed палитра
  // есть у всех автомобилей, но требовать её от черновика незачем.
  colorIds: uniqueIds("цвета не должны повторяться"),
});

export const createAdminCarSchema = adminCarFieldsSchema;

/** Любое подмножество полей; `colorIds`, если передан, заменяет палитру целиком. */
export const updateAdminCarSchema = adminCarFieldsSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), "нечего сохранять");

export type CreateAdminCar = z.infer<typeof createAdminCarSchema>;
export type UpdateAdminCar = z.infer<typeof updateAdminCarSchema>;

// ---------------------------------------------------------------------
// GET /api/admin/cars/:id — и ответ всех мутаций карточки
// ---------------------------------------------------------------------

export const adminCarImageSchema = z.object({
  id: idSchema,
  position: z.number().int().positive(),
  path: z.string(),
  alt: z.string(),
});

/** Путь к GLB и материал краски есть только вместе (CHECK cars_model_3d_ck). */
export const adminCarModelSchema = z.object({
  path: z.string(),
  paintMaterial: z.string(),
});

/** Ответ — данные из БД, поэтому без правил ввода: строки и числа как есть. */
export const adminCarSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  seriesId: idSchema,
  bodyTypeId: idSchema,
  fuelTypeId: idSchema,
  driveType: z.enum(driveTypes),
  modelYear: z.number().int(),
  description: z.string(),
  powerHp: z.number().int(),
  // numeric в БД — строка на проводе
  accelerationS: z.string(),
  topSpeedKmh: z.number().int(),
  price: moneySchema,
  colorIds: z.array(idSchema),
  // по position, первое — обложка
  images: z.array(adminCarImageSchema),
  model: adminCarModelSchema.nullable(),
  isPublished: z.boolean(),
  // записи в любом статусе: при > 0 удалить нельзя (CAR_HAS_TEST_DRIVES)
  testDrivesCount: z.number().int().nonnegative(),
});

export type AdminCarImage = z.infer<typeof adminCarImageSchema>;
export type AdminCarModel = z.infer<typeof adminCarModelSchema>;
export type AdminCar = z.infer<typeof adminCarSchema>;

// ---------------------------------------------------------------------
// Фото и 3D-модель (UC-A5, UC-A6). Файл идёт multipart-ом, здесь —
// только текстовые поля рядом с ним.
// ---------------------------------------------------------------------

/** PATCH .../images/:imageId и поле `alt` при загрузке; CHECK car_images_alt_ck. */
export const carImageAltSchema = z.object({
  alt: z.string().trim().min(1, "укажите описание фото").max(200, "не длиннее 200 символов"),
});

/** Поле рядом с GLB в PUT .../model; по этому материалу 3D-просмотр перекрашивает кузов. */
export const carModelFieldsSchema = z.object({
  paintMaterial: z
    .string()
    .trim()
    .min(1, "укажите материал краски")
    .max(100, "не длиннее 100 символов")
    .default("CarPaint"),
});

/** PUT .../images/order — полный новый порядок; совпадение с текущими фото проверяет API. */
export const carImagesOrderSchema = z.object({
  imageIds: uniqueIds("фото не должны повторяться").min(1, "передайте порядок фото"),
});

export type CarImageAlt = z.infer<typeof carImageAltSchema>;
export type CarModelFields = z.infer<typeof carModelFieldsSchema>;
export type CarImagesOrder = z.infer<typeof carImagesOrderSchema>;
