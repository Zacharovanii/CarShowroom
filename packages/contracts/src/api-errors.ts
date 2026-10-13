import { z } from "zod";

/**
 * Коды ошибок API (docs/architecture.md, «Коды ошибок») + INTERNAL_ERROR — общий код
 * для непредвиденных сбоев 500, к бизнес-логике не относится.
 * `AppError` в apps/api берёт код только отсюда — новый код сначала
 * появляется здесь, потом используется в сервисе.
 */
export const errorCodes = [
  "SLOT_TAKEN",
  "TOO_MANY_ACTIVE",
  "SLOT_OUT_OF_RANGE",
  "SLOT_NOT_ON_GRID",
  "ALREADY_CLOSED",
  "TOO_LATE_TO_CANCEL",
  "SLOT_NOT_STARTED",
  "EMAIL_TAKEN",
  "NOT_FOUND",
  "FORBIDDEN",
  "VALIDATION_FAILED",
  // управление каталогом, D26
  "SLUG_TAKEN",
  "NAME_TAKEN",
  "CAR_HAS_TEST_DRIVES",
  "CAR_NOT_READY",
  "LAST_IMAGE",
  "INVALID_FILE",
  "FILE_TOO_LARGE",
  // в details.materials — имена материалов из загруженного GLB
  "PAINT_MATERIAL_NOT_FOUND",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof errorCodes)[number];

/**
 * Единый формат ошибки API. Бэкенд отдаёт его на любом коде 4xx/5xx,
 * фронт разбирает и показывает сообщение по `code`.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
