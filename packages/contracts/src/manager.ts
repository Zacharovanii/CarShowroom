import { z } from "zod";
import {
  SALON_TIME_ZONE,
  daySchema,
  instantSchema,
  phoneSchema,
  timeLabelSchema,
} from "./common.js";
import { testDriveCarSchema, testDriveStatuses } from "./test-drives.js";

// ---------------------------------------------------------------------
// GET /api/manager/test-drives?date=YYYY-MM-DD&carId=&status=
// ---------------------------------------------------------------------

export const managerTestDrivesQuerySchema = z.object({
  date: daySchema,
  carId: z.coerce.number().int().positive().optional(),
  status: z.enum(testDriveStatuses).optional(),
});

export type ManagerTestDrivesQuery = z.infer<typeof managerTestDrivesQuerySchema>;

/**
 * Клиент записи. Телефон и email отдаются только менеджеру и админу
 * (сквозное требование use-cases.md) — в клиентских ответах их нет.
 * `phone` в самой записи может отличаться: при записи клиент вправе
 * указать другой контакт (UC-U3).
 */
export const testDriveClientSchema = z.object({
  name: z.string(),
  email: z.email(),
  phone: phoneSchema,
});

export const managerTestDriveSchema = z.object({
  id: z.number().int().positive(),
  car: testDriveCarSchema,
  startsAt: instantSchema,
  time: timeLabelSchema,
  status: z.enum(testDriveStatuses),
  client: testDriveClientSchema,
  /** Контакт, указанный в этой записи. */
  phone: phoneSchema,
  comment: z.string().nullable(),
  cancelReason: z.string().nullable(),
  createdAt: instantSchema,
  /**
   * Слот уже начался. Из него и статуса выводится набор действий (UC-M2):
   * до начала — «Отменить», после — «Состоялся» / «Не пришёл»; у закрытой
   * записи действий нет. Считается на сервере, чтобы правило TD-9 не
   * повторялось на фронте.
   */
  started: z.boolean(),
});

export const managerTestDrivesSchema = z.object({
  date: daySchema,
  timeZone: z.literal(SALON_TIME_ZONE),
  items: z.array(managerTestDriveSchema),
});

export type TestDriveClient = z.infer<typeof testDriveClientSchema>;
export type ManagerTestDrive = z.infer<typeof managerTestDriveSchema>;
export type ManagerTestDrives = z.infer<typeof managerTestDrivesSchema>;

// ---------------------------------------------------------------------
// PATCH /api/manager/test-drives/:id
// ---------------------------------------------------------------------

/**
 * Закрытие записи (TD-9). Союз по статусу, а не одно поле с опциональной
 * причиной: у отмены причина обязательна (её видит клиент), у остальных
 * исходов её быть не должно — это же требует CHECK test_drives_reason_ck.
 */
export const closeTestDriveSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("cancelled"),
    cancelReason: z.string().trim().min(1).max(500),
  }),
  z.strictObject({
    status: z.enum(["completed", "no_show"]),
  }),
]);

export type CloseTestDrive = z.infer<typeof closeTestDriveSchema>;
