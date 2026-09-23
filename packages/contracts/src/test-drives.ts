import { z } from "zod";

/**
 * Статусы записи (TD-9): открытая `scheduled` → результат визита от менеджера
 * (`completed` / `no_show`) или отмена (`cancelled`, клиентом или менеджером).
 */
export const testDriveStatuses = ["scheduled", "completed", "no_show", "cancelled"] as const;

export type TestDriveStatus = (typeof testDriveStatuses)[number];

/** Часовой пояс салона (TD-3) — один на весь проект, второго не будет. */
export const SALON_TIME_ZONE = "Europe/Moscow";

/** День в сетке слотов и в фильтрах — календарная дата пояса салона, без времени. */
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "дата в формате YYYY-MM-DD");

/** Телефон в формате РФ — тот же CHECK, что и в схеме БД. */
const phoneSchema = z.string().regex(/^\+7\d{10}$/, "телефон в формате +7XXXXXXXXXX");

/** Момент начала слота — ISO-строка с временной зоной (даты на проводе — строки). */
const instantSchema = z.iso.datetime({ offset: true });

// ---------------------------------------------------------------------
// GET /api/cars/:slug/slots?date=YYYY-MM-DD
// ---------------------------------------------------------------------

export const slotsQuerySchema = z.object({
  date: daySchema,
});

export type SlotsQuery = z.infer<typeof slotsQuerySchema>;

/**
 * Слот дня. В БД слотов нет — сетка вычисляется в API (TD-1, TD-2), поэтому
 * `free` (никто не записан) и `bookable` (можно записаться прямо сейчас —
 * свободен и попадает в окно записи TD-5) считаются на каждый запрос.
 */
export const slotSchema = z.object({
  startsAt: instantSchema,
  /** Время начала в поясе салона, «10:00» — подпись кнопки в сетке. */
  time: z.string().regex(/^\d{2}:\d{2}$/),
  free: z.boolean(),
  bookable: z.boolean(),
});

export const slotsResponseSchema = z.object({
  date: daySchema,
  timeZone: z.literal(SALON_TIME_ZONE),
  slots: z.array(slotSchema),
});

export type Slot = z.infer<typeof slotSchema>;
export type SlotsResponse = z.infer<typeof slotsResponseSchema>;

// ---------------------------------------------------------------------
// GET /api/me/test-drives
// ---------------------------------------------------------------------

/** Автомобиль внутри записи — ровно то, чем подписана строка в «Моих записях». */
export const testDriveCarSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  name: z.string(),
  coverPath: z.string().nullable(),
  coverAlt: z.string().nullable(),
});

export const testDriveSchema = z.object({
  id: z.number().int().positive(),
  car: testDriveCarSchema,
  startsAt: instantSchema,
  status: z.enum(testDriveStatuses),
  phone: phoneSchema,
  comment: z.string().nullable(),
  /** Заполнена, только если запись отменил менеджер (UC-U4). */
  cancelReason: z.string().nullable(),
  createdAt: instantSchema,
  /** Можно ли отменить сейчас (TD-7) — чтобы фронт не повторял правило. */
  cancellable: z.boolean(),
});

/** Две вкладки UC-U4: «Предстоящие» и «История». */
export const myTestDrivesSchema = z.object({
  upcoming: z.array(testDriveSchema),
  history: z.array(testDriveSchema),
});

export type TestDriveCar = z.infer<typeof testDriveCarSchema>;
export type TestDrive = z.infer<typeof testDriveSchema>;
export type MyTestDrives = z.infer<typeof myTestDrivesSchema>;

// ---------------------------------------------------------------------
// POST /api/me/test-drives
// ---------------------------------------------------------------------

export const createTestDriveSchema = z.object({
  carId: z.number().int().positive(),
  startsAt: instantSchema,
  phone: phoneSchema,
  comment: z.string().trim().min(1).max(500).optional(),
});

export type CreateTestDrive = z.infer<typeof createTestDriveSchema>;
