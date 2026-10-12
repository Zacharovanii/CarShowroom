import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import type { AdminCar } from "@carshowroom/contracts";
import { Alert, Button, Dialog, DialogClose, DialogContent, useToast } from "@/components/ui";
import { ApiError } from "@/shared/api";
import { adminCarsKeys } from "./keys";
import { useDeleteAdminCar, usePublishAdminCar, useUnpublishAdminCar } from "./useAdminCars";
import styles from "./AdminCarActions.module.css";

export interface AdminCarActionsProps {
  car: AdminCar;
  /** Автомобиль удалён: странице пора уйти в список. */
  onDeleted: () => void;
}

/** Какой диалог открыт: подтверждение удаления или отказ из-за записей. */
type DeleteStep = "confirm" | "blocked";

const NOT_READY = "Чтобы опубликовать, загрузите хотя бы одно фото";

function isError(error: unknown, code: "CAR_NOT_READY" | "CAR_HAS_TEST_DRIVES"): boolean {
  return error instanceof ApiError && error.is(code);
}

/**
 * Публикация (UC-A4) и удаление (UC-A3 п.4) карточки.
 *
 * Сервер — источник истины: кнопки не прячутся заранее по данным карточки
 * (фото нет, записи есть), а запрос всегда уходит, и отказ объясняется
 * по коду ответа. Данные карточки дают только подсказки рядом.
 */
export function AdminCarActions({ car, onDeleted }: AdminCarActionsProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const publish = usePublishAdminCar(car.id);
  const unpublish = useUnpublishAdminCar(car.id);
  const deleteCar = useDeleteAdminCar(car.id);

  const [step, setStep] = useState<DeleteStep | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleUnpublish(): Promise<boolean> {
    try {
      await unpublish.mutateAsync();
    } catch {
      toast({ tone: "error", description: "Не удалось снять с публикации. Попробуйте ещё раз." });
      return false;
    }
    toast({ tone: "success", description: "Снят с публикации — в каталоге его больше нет" });
    return true;
  }

  async function handlePublish() {
    try {
      await publish.mutateAsync();
    } catch (error) {
      toast({
        tone: "error",
        description: isError(error, "CAR_NOT_READY")
          ? NOT_READY
          : "Не удалось опубликовать. Попробуйте ещё раз.",
      });
      return;
    }
    toast({ tone: "success", description: "Опубликован — автомобиль появился в каталоге" });
  }

  function openDelete() {
    setDeleteError(null);
    setStep("confirm");
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteCar.mutateAsync();
    } catch (error) {
      if (isError(error, "CAR_HAS_TEST_DRIVES")) {
        // Счётчик в кеше мог устареть — пока открыт диалог, карточка перечитается
        void queryClient.invalidateQueries({ queryKey: adminCarsKeys.detail(car.id) });
        setStep("blocked");
        return;
      }
      setDeleteError("Не удалось удалить автомобиль. Попробуйте ещё раз.");
      return;
    }
    toast({ tone: "success", description: `«${car.name}» удалён` });
    onDeleted();
  }

  async function unpublishFromDialog() {
    if (await handleUnpublish()) setStep(null);
  }

  const count = car.testDrivesCount > 0 ? ` (${car.testDrivesCount})` : "";

  return (
    <>
      <div className={styles.actions}>
        {car.isPublished ? (
          <Button
            iconStart={<EyeOff aria-hidden="true" />}
            loading={unpublish.isPending}
            onClick={() => void handleUnpublish()}
          >
            Снять с публикации
          </Button>
        ) : (
          <Button
            variant="primary"
            iconStart={<Eye aria-hidden="true" />}
            loading={publish.isPending}
            onClick={() => void handlePublish()}
          >
            Опубликовать
          </Button>
        )}

        <Button variant="danger" iconStart={<Trash2 aria-hidden="true" />} onClick={openDelete}>
          Удалить
        </Button>
      </div>

      {(!car.isPublished && car.images.length === 0) || car.testDrivesCount > 0 ? (
        <ul className={styles.notes}>
          {!car.isPublished && car.images.length === 0 && <li>{NOT_READY}.</li>}
          {car.testDrivesCount > 0 && (
            <li>
              Есть записи на тест-драйв ({car.testDrivesCount}) — удалить автомобиль не получится,
              только снять с публикации.
            </li>
          )}
        </ul>
      ) : null}

      <Dialog open={step !== null} onOpenChange={(open) => !open && setStep(null)}>
        {step === "confirm" && (
          <DialogContent
            title="Удалить автомобиль?"
            description={`Удалить «${car.name}»? Фото и 3D-модель тоже будут удалены. Действие необратимо.`}
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="ghost">Отмена</Button>
                </DialogClose>
                <Button
                  variant="danger"
                  loading={deleteCar.isPending}
                  onClick={() => void handleDelete()}
                >
                  Удалить
                </Button>
              </>
            }
          >
            {deleteError && <Alert variant="error">{deleteError}</Alert>}
          </DialogContent>
        )}

        {step === "blocked" && (
          <DialogContent
            title="Удалить нельзя"
            description={
              car.isPublished
                ? `На автомобиль есть записи на тест-драйв${count}. Можно снять его с публикации — он пропадёт из каталога, а записи сохранятся.`
                : `На автомобиль есть записи на тест-драйв${count}. Он уже снят с публикации и в каталоге не виден, а записи сохраняются.`
            }
            footer={
              car.isPublished ? (
                <>
                  <DialogClose asChild>
                    <Button variant="ghost">Отмена</Button>
                  </DialogClose>
                  <Button
                    variant="primary"
                    loading={unpublish.isPending}
                    onClick={() => void unpublishFromDialog()}
                  >
                    Снять с публикации
                  </Button>
                </>
              ) : (
                <DialogClose asChild>
                  <Button variant="primary">Понятно</Button>
                </DialogClose>
              )
            }
          />
        )}
      </Dialog>
    </>
  );
}
