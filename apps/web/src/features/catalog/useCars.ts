import { useQuery } from "@tanstack/react-query";
import { carsResponseSchema, type CarsQuery } from "@carshowroom/contracts";
import { apiFetch } from "@/shared/api";

/**
 * `GET /api/cars`. Ответ разбирается схемой контракта: если фронт и API
 * разойдутся, это станет видно здесь, а не в вёрстке.
 */
export function useCars(params: Partial<CarsQuery> = {}) {
  const query: Record<string, string | number | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query[key] = value;
  }

  return useQuery({
    queryKey: ["cars", query],
    queryFn: ({ signal }) => apiFetch("/cars", { query, schema: carsResponseSchema, signal }),
  });
}
