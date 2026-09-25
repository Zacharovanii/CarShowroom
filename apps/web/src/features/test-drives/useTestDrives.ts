import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  myTestDrivesSchema,
  slotsResponseSchema,
  testDriveSchema,
  type CreateTestDrive,
} from "@carshowroom/contracts";
import { apiFetch } from "@/shared/api";

/** Ключи запросов фичи: сетка слотов одного дня и список записей клиента. */
export const slotsKey = (slug: string, date: string) => ["car-slots", slug, date] as const;
export const myTestDrivesKey = ["me", "test-drives"] as const;

/**
 * `GET /api/cars/:slug/slots?date=` — сетка дня (UC-G4). Открыта гостю.
 *
 * `staleTime: 0`: `free` и `bookable` сервер считает на момент ответа
 * (TD-5), и «свежесть» здесь означала бы окно, в котором сетка показывает
 * свободным то, что уже заняли, или доступным слот, до которого осталось
 * меньше двух часов.
 */
export function useSlots(slug: string | undefined, date: string) {
  return useQuery({
    queryKey: slotsKey(slug ?? "", date),
    enabled: slug !== undefined,
    queryFn: ({ signal }) =>
      apiFetch(`/cars/${encodeURIComponent(slug ?? "")}/slots`, {
        query: { date },
        schema: slotsResponseSchema,
        signal,
      }),
    staleTime: 0,
  });
}

/**
 * `GET /api/me/test-drives` — «Мои записи» (UC-U4) и источник числа активных
 * записей для лимита TD-6 на странице автомобиля.
 *
 * `enabled` обязателен: маршрут доступен только роли `user`, и у гостя
 * с сотрудником запрос ушёл бы в 401/403 без всякой пользы.
 */
export function useMyTestDrives(enabled: boolean) {
  return useQuery({
    queryKey: myTestDrivesKey,
    enabled,
    queryFn: ({ signal }) => apiFetch("/me/test-drives", { schema: myTestDrivesSchema, signal }),
    staleTime: 0,
  });
}

/**
 * `POST /api/me/test-drives` — запись (UC-U3). Тело собирается
 * `createTestDriveSchema` на вызывающей стороне: отметки TD-8 живут только
 * на клиенте и в запрос не попадают (D22).
 *
 * Инвалидируется и список записей, и все сетки слотов: занятый слот меняет
 * вид не только того дня, который открыт сейчас.
 */
export function useCreateTestDrive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateTestDrive) =>
      apiFetch("/me/test-drives", { method: "POST", body, schema: testDriveSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myTestDrivesKey });
      void queryClient.invalidateQueries({ queryKey: ["car-slots"] });
    },
  });
}

/** `POST /api/me/test-drives/:id/cancel` — отмена клиентом (UC-U4, TD-7). */
export function useCancelTestDrive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/me/test-drives/${id}/cancel`, { method: "POST", schema: testDriveSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myTestDrivesKey });
      void queryClient.invalidateQueries({ queryKey: ["car-slots"] });
    },
  });
}
