import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminCarOptionsSchema,
  adminCarSchema,
  adminCarsResponseSchema,
  type AdminCarsQuery,
  type CreateAdminCar,
  type UpdateAdminCar,
} from "@carshowroom/contracts";
import { apiFetch } from "@/shared/api";
import { adminCarsKeys, forgetAdminCar, syncAdminCar } from "./keys";

/**
 * `GET /api/admin/cars` (UC-A3). Ответ разбирается схемой контракта: если
 * фронт и API разойдутся, это станет видно здесь, а не в вёрстке.
 */
export function useAdminCars(params: AdminCarsQuery) {
  const query: Record<string, string | number | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query[key] = value;
  }

  return useQuery({
    queryKey: adminCarsKeys.list(query),
    queryFn: ({ signal }) =>
      apiFetch("/admin/cars", { query, schema: adminCarsResponseSchema, signal }),
  });
}

/**
 * `GET /api/admin/cars/options` — справочники для формы. Из интерфейса они
 * не меняются, поэтому запрос не протухает, как и фильтры каталога.
 */
export function useAdminCarOptions() {
  return useQuery({
    queryKey: adminCarsKeys.options(),
    queryFn: ({ signal }) =>
      apiFetch("/admin/cars/options", { schema: adminCarOptionsSchema, signal }),
    staleTime: Infinity,
  });
}

/**
 * `GET /api/admin/cars/:id` (UC-A4). `id` может быть ещё не известен —
 * например, в адресе не число; тогда запрос не уходит.
 */
export function useAdminCar(id: number | undefined) {
  return useQuery({
    queryKey: adminCarsKeys.detail(id ?? 0),
    enabled: id !== undefined,
    queryFn: ({ signal }) => apiFetch(`/admin/cars/${id}`, { schema: adminCarSchema, signal }),
  });
}

/** `POST /api/admin/cars` — черновик; ответ сразу кладётся в кеш карточки. */
export function useCreateAdminCar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateAdminCar) =>
      apiFetch("/admin/cars", { method: "POST", body, schema: adminCarSchema }),
    onSuccess: (car) => syncAdminCar(queryClient, car),
  });
}

/** `PATCH /api/admin/cars/:id` — любое подмножество полей. */
export function useUpdateAdminCar(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateAdminCar) =>
      apiFetch(`/admin/cars/${id}`, { method: "PATCH", body, schema: adminCarSchema }),
    onSuccess: (car) => syncAdminCar(queryClient, car),
  });
}

/** `POST .../publish`; без фото API ответит 409 `CAR_NOT_READY`. */
export function usePublishAdminCar(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch(`/admin/cars/${id}/publish`, { method: "POST", schema: adminCarSchema }),
    onSuccess: (car) => syncAdminCar(queryClient, car),
  });
}

/** `POST .../unpublish` — машина уходит из каталога, записи остаются. */
export function useUnpublishAdminCar(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch(`/admin/cars/${id}/unpublish`, { method: "POST", schema: adminCarSchema }),
    onSuccess: (car) => syncAdminCar(queryClient, car),
  });
}

/** `DELETE /api/admin/cars/:id` (204); с записями — 409 `CAR_HAS_TEST_DRIVES`. */
export function useDeleteAdminCar(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<void>(`/admin/cars/${id}`, { method: "DELETE" }),
    onSuccess: () => forgetAdminCar(queryClient, id),
  });
}
