import { z } from "zod";
import {
  SALON_TIME_ZONE,
  daySchema,
  instantSchema,
  phoneSchema,
  timeLabelSchema,
} from "./common.js";

/**
 * Статусы записи (TD-9): открытая `scheduled` → результат визита от менеджера
 * (`completed` / `no_show`) или отмена (`cancelled`, клиентом или менеджером).
 */
export const testDriveStatuses = ["scheduled", "completed", "no_show", "cancelled"] as const;

export type TestDriveStatus = (typeof testDriveStatuses)[number];

/**
 * TD-6: не больше двух активных будущих записей у клиента.
 *
 * Правило проверяет сервер, но число нужно и фронту — чтобы погасить кнопку
 * заранее и не вести человека в модалку ради ошибки 422 (раздел 4
 * docs/wireframes.md). Живёт в контракте по той же причине, что и
 * CARS_PAGE_SIZE: иначе двойка разъезжается между apps/api и apps/web,
 * и расхождение заметят только на защите.
 */
export const MAX_ACTIVE_TEST_DRIVES = 2;

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
  time: timeLabelSchema,
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
