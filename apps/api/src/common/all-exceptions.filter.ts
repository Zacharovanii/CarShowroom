import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { ApiError, ErrorCode } from "@carshowroom/contracts";
import { AppError } from "./app-error.js";

// Не тянем @types/express ради одной сигнатуры: платформа Nest (express)
// не важна для формата ответа, важны только status()/json().
interface HttpResponseLike {
  status(code: number): this;
  json(body: unknown): unknown;
}

// postgres.js бросает обычный объект с полем `code` — кодом ошибки Postgres
// (не HTTP-статусом). 23505 — unique_violation. Отдельного класса ошибки
// драйвера тут не проверяем: важно только поле, оно документировано.
function isUniqueViolation(exception: unknown): exception is { code: "23505" } {
  return (
    typeof exception === "object" &&
    exception !== null &&
    "code" in exception &&
    (exception as { code: unknown }).code === "23505"
  );
}

// Nest переводит ошибки multer в HttpException по тексту сообщения, а multer 2
// часть текстов поменял (лишнее поле-файл — «Unexpected file field» вместо
// «Unexpected field»), и такая ошибка доходит сюда как есть. Узнаём её по
// name и code — их multer документирует, тип ради этого не импортируем.
function isMulterError(exception: unknown): exception is { code: string; field?: string } {
  return (
    exception instanceof Error &&
    exception.name === "MulterError" &&
    typeof (exception as { code?: unknown }).code === "string"
  );
}

// Прочие HttpException (guard'ы Better Auth, встроенные исключения Nest) —
// не доменные AppError, но ответ всё равно должен быть в формате
// apiErrorSchema, а не в дефолтном `{ statusCode, message, error }` Nest.
function codeForHttpStatus(status: number): ErrorCode {
  if (status === 401 || status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 400 || status === 422) return "VALIDATION_FAILED";
  // 413 даёт только multer: файл больше limits.fileSize в FileInterceptor
  if (status === 413) return "FILE_TOO_LARGE";
  return "INTERNAL_ERROR";
}

// Сообщение multer — английское «File too large», а форма показывает
// message у поля загрузки как есть.
const FILE_TOO_LARGE_MESSAGE = "Файл слишком большой";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponseLike>();
    const { status, body } = this.toApiError(exception);

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json(body);
  }

  private toApiError(exception: unknown): { status: number; body: ApiError } {
    if (exception instanceof AppError) {
      return {
        status: exception.status,
        body: {
          error: { code: exception.code, message: exception.message, details: exception.details },
        },
      };
    }

    if (isUniqueViolation(exception)) {
      return {
        status: 409,
        body: { error: { code: "SLOT_TAKEN", message: "Слот уже занят" } },
      };
    }

    if (isMulterError(exception)) {
      // сейчас LIMIT_FILE_SIZE Nest узнаёт сам (413 ниже), но код надёжнее текста
      if (exception.code === "LIMIT_FILE_SIZE") {
        return {
          status: 413,
          body: { error: { code: "FILE_TOO_LARGE", message: FILE_TOO_LARGE_MESSAGE } },
        };
      }
      return {
        status: 400,
        body: {
          error: {
            code: "VALIDATION_FAILED",
            message: "Некорректная форма загрузки",
            details: { field: exception.field, reason: exception.code },
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        body: {
          error: {
            code: codeForHttpStatus(status),
            message: status === 413 ? FILE_TOO_LARGE_MESSAGE : exception.message,
          },
        },
      };
    }

    return {
      status: 500,
      body: { error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" } },
    };
  }
}
