import type { ErrorCode } from "@carshowroom/contracts";

// HTTP-статус зависит только от кода ошибки — сервис не должен решать это
// сам в каждом месте, где бросает AppError.
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  SLOT_TAKEN: 409,
  TOO_MANY_ACTIVE: 422,
  SLOT_OUT_OF_RANGE: 422,
  SLOT_NOT_ON_GRID: 422,
  ALREADY_CLOSED: 409,
  TOO_LATE_TO_CANCEL: 422,
  EMAIL_TAKEN: 409,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 400,
  INTERNAL_ERROR: 500,
};

/**
 * Ожидаемая доменная ошибка ("этот слот занят", "нет такой записи").
 * Код — только из ErrorCode contracts (см. errorCodes), сообщение — для
 * человека, details — опционально, попадает в apiErrorSchema как есть.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}
