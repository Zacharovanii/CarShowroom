import { useQuery } from "@tanstack/react-query";
import { carDetailsSchema } from "@carshowroom/contracts";
import { apiFetch, ApiError } from "@/shared/api";

/**
 * `GET /api/cars/:slug` — UC-G3. Ответ разбирается схемой контракта, как
 * и в каталоге: расхождение фронта и API видно здесь, а не в вёрстке.
 *
 * Повтор 404 гасит общая политика QueryClient (status < 500 не повторяется),
 * поэтому «Автомобиль не найден» показывается сразу.
 */
export function useCar(slug: string | undefined) {
  return useQuery({
    queryKey: ["car", slug],
    enabled: slug !== undefined,
    queryFn: ({ signal }) =>
      apiFetch(`/cars/${encodeURIComponent(slug ?? "")}`, {
        schema: carDetailsSchema,
        signal,
      }),
  });
}

/**
 * Снят с публикации или ссылка устарела. API отвечает 404 с кодом
 * `NOT_FOUND`; проверяем и то и другое — код важнее статуса, но на
 * неожиданном теле (прокси, упавший процесс) остаётся только статус.
 */
export function isCarNotFound(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.code === "NOT_FOUND");
}
