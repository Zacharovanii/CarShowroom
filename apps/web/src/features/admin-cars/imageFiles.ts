import { ApiError, NetworkError } from "@/shared/api";

/** Что принимает сервер (проверка по содержимому — в API, здесь только фильтр диалога). */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/**
 * Лимит фото — как `IMAGE_MAX_BYTES` в API. Предпроверка только экономит
 * заведомо лишнюю загрузку; источник истины — 413 `FILE_TOO_LARGE` сервера.
 */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const IMAGE_TOO_LARGE = "Файл больше 10 МБ";

/** Ошибка загрузки или замены файла фото → текст у файла или у фото. */
export function imageFileError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.is("INVALID_FILE")) return "Файл не похож на JPEG, PNG, WebP или AVIF";
    if (error.is("FILE_TOO_LARGE")) return IMAGE_TOO_LARGE;
    return error.message;
  }
  if (error instanceof NetworkError) return error.message;
  return "Не удалось загрузить файл. Попробуйте ещё раз.";
}
