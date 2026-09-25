import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  managerTestDriveSchema,
  managerTestDrivesSchema,
  type CloseTestDrive,
  type ManagerTestDrivesQuery,
} from "@carshowroom/contracts";
import { apiFetch } from "@/shared/api";

const KEY = ["manager", "test-drives"] as const;

/**
 * `GET /api/manager/test-drives`. Фильтры уходят на сервер параметрами —
 * `carId` и `status` предусмотрены `managerTestDrivesQuerySchema`,
 * отбирать записи на фронте незачем.
 *
 * `staleTime: 0` в отличие от каталога: `started` считается сервером на момент
 * ответа, и минута «свежести» означала бы минуту, в течение которой начавшийся
 * слот не подсвечен и кнопки результата не появились.
 */
export function useManagerDay(query: ManagerTestDrivesQuery) {
  return useQuery({
    queryKey: [...KEY, query.date, query.carId ?? null, query.status ?? null],
    queryFn: ({ signal }) =>
      apiFetch("/manager/test-drives", {
        query: { date: query.date, carId: query.carId, status: query.status },
        schema: managerTestDrivesSchema,
        signal,
      }),
    staleTime: 0,
  });
}

export interface CloseTestDriveInput {
  id: number;
  body: CloseTestDrive;
}

/**
 * `PATCH /api/manager/test-drives/:id` — закрытие записи (UC-M2).
 * После успеха перечитывается весь день: изменилась не только строка,
 * но и то, что сервер думает о наборе действий соседних записей.
 */
export function useCloseTestDrive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: CloseTestDriveInput) =>
      apiFetch(`/manager/test-drives/${id}`, {
        method: "PATCH",
        body,
        schema: managerTestDriveSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
