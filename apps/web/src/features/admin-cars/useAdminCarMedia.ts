import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminCarSchema,
  type CarImageAlt,
  type CarImagesOrder,
  type CarModelFields,
} from "@carshowroom/contracts";
import { apiFetch } from "@/shared/api";
import { syncAdminCar } from "./keys";

/**
 * Фото и 3D-модель карточки (UC-A5, UC-A6). Все ответы — полная `AdminCar`,
 * поэтому после любой правки карточка в кеше заменяется целиком. Ошибки
 * файла (`INVALID_FILE`, `FILE_TOO_LARGE`, `PAINT_MATERIAL_NOT_FOUND`)
 * здесь не перехватываются — их разбирает блок, который знает, что показать.
 */

/** Аргументы мутаций: файл живёт только в браузере, поэтому его нет в контракте. */
export type UploadCarImageInput = CarImageAlt & { file: File };
export type ReplaceCarImageFileInput = { imageId: number; file: File };
export type UpdateCarImageAltInput = CarImageAlt & { imageId: number };
export type UploadCarModelInput = CarModelFields & { file: File };

/** `POST .../images` — новое фото встаёт в конец. */
export function useUploadCarImage(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, alt }: UploadCarImageInput) => {
      const body = new FormData();
      body.append("file", file);
      body.append("alt", alt);
      return apiFetch(`/admin/cars/${id}/images`, {
        method: "POST",
        body,
        schema: adminCarSchema,
      });
    },
    onSuccess: (car) => syncAdminCar(queryClient, car),
  });
}

/** `PUT .../images/:imageId/file` — новый файл на том же месте, подпись остаётся. */
export function useReplaceCarImageFile(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ imageId, file }: ReplaceCarImageFileInput) => {
      const body = new FormData();
      body.append("file", file);
      return apiFetch(`/admin/cars/${id}/images/${imageId}/file`, {
        method: "PUT",
        body,
        schema: adminCarSchema,
      });
    },
    onSuccess: (car) => syncAdminCar(queryClient, car),
  });
}

/** `PATCH .../images/:imageId` — только подпись. */
export function useUpdateCarImageAlt(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ imageId, alt }: UpdateCarImageAltInput) =>
      apiFetch(`/admin/cars/${id}/images/${imageId}`, {
        method: "PATCH",
        body: { alt },
        schema: adminCarSchema,
      }),
    onSuccess: (car) => syncAdminCar(queryClient, car),
  });
}

/** `PUT .../images/order` — полный новый порядок; первое фото становится обложкой. */
export function useReorderCarImages(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CarImagesOrder) =>
      apiFetch(`/admin/cars/${id}/images/order`, {
        method: "PUT",
        body,
        schema: adminCarSchema,
      }),
    onSuccess: (car) => syncAdminCar(queryClient, car),
  });
}

/** `DELETE .../images/:imageId`; последнее фото опубликованной — 409 `LAST_IMAGE`. */
export function useDeleteCarImage(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: number) =>
      apiFetch(`/admin/cars/${id}/images/${imageId}`, {
        method: "DELETE",
        schema: adminCarSchema,
      }),
    onSuccess: (car) => syncAdminCar(queryClient, car),
  });
}

/** `PUT .../model` — загрузка или замена GLB вместе с именем материала краски. */
export function useUploadCarModel(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, paintMaterial }: UploadCarModelInput) => {
      const body = new FormData();
      body.append("file", file);
      body.append("paintMaterial", paintMaterial);
      return apiFetch(`/admin/cars/${id}/model`, { method: "PUT", body, schema: adminCarSchema });
    },
    onSuccess: (car) => syncAdminCar(queryClient, car),
  });
}

/** `DELETE .../model` — карточка остаётся с фото, 3D-просмотр пропадает. */
export function useDeleteCarModel(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch(`/admin/cars/${id}/model`, { method: "DELETE", schema: adminCarSchema }),
    onSuccess: (car) => syncAdminCar(queryClient, car),
  });
}
