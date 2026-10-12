import { apiErrorSchema, type ErrorCode } from "@carshowroom/contracts";
import type { ZodType } from "zod";

/**
 * Единственная точка выхода в API. Страницы сюда не ходят — только хуки фич.
 *
 * Базовый путь относительный: в dev его разворачивает прокси Vite, в проде
 * Nest раздаёт фронт и API с одного хоста. В обоих случаях origin один,
 * поэтому cookie сессии Better Auth ходит сама.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

/**
 * Ошибка API в разобранном виде. `code` — из `errorCodes` контракта, по нему
 * фича решает, что показать: у SLOT_TAKEN и TOO_MANY_ACTIVE разные тексты
 * и разные действия (UC-U3).
 */
export class ApiError extends Error {
  readonly code: ErrorCode | string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode | string,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  is(code: ErrorCode): boolean {
    return this.code === code;
  }
}

/** Сеть не ответила вовсе — это не ошибка API, у неё нет кода из контракта. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Не удалось связаться с сервером");
    this.name = "NetworkError";
    this.cause = cause;
  }
}

type RequestOptions<T> = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Объект уходит JSON-ом; `FormData` — как есть, multipart (фото, GLB). */
  body?: unknown;
  /** Схема ответа из contracts. Её разбор — защита от расхождения фронта и API. */
  schema?: ZodType<T>;
  signal?: AbortSignal;
  /** Параметры запроса; undefined и пустые строки отбрасываются. */
  query?: Record<string, string | number | undefined>;
};

function buildUrl(path: string, query?: RequestOptions<unknown>["query"]): string {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }

  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  const { method = "GET", body, schema, signal, query } = options;

  // Content-Type у multipart ставит сам браузер: в заголовке нужна граница
  // частей (boundary), которую знает только он. Свой заголовок её бы затёр.
  const isForm = body instanceof FormData;
  const isJson = body !== undefined && !isForm;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      signal,
      credentials: "include",
      headers: isJson ? { "Content-Type": "application/json" } : undefined,
      body: isForm ? body : isJson ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    // AbortError пробрасываем как есть: его гасит TanStack Query, а не UI
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new NetworkError(cause);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json();
  // Без схемы возвращаем как есть — так вызываются маршруты без тела ответа
  return schema ? schema.parse(data) : (data as T);
}

/**
 * Любой 4xx/5xx нашего API приходит в едином формате из contracts. Если тело
 * не разобралось — значит ответил не наш обработчик (прокси, статика,
 * упавший процесс), и код придумывать нельзя: ставим INTERNAL_ERROR.
 */
async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return new ApiError("INTERNAL_ERROR", "Сервер ответил неожиданным образом", response.status);
  }

  const parsed = apiErrorSchema.safeParse(payload);
  if (!parsed.success) {
    return new ApiError("INTERNAL_ERROR", "Сервер ответил неожиданным образом", response.status);
  }

  const { code, message, details } = parsed.data.error;
  return new ApiError(code, message, response.status, details);
}
