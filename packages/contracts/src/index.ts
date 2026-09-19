import { z } from "zod";

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
