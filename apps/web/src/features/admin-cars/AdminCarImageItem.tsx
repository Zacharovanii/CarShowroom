import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { carImageAltSchema, type AdminCarImage } from "@carshowroom/contracts";
import { ArrowDown, ArrowUp, ImageUp, Trash2 } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Field,
  IconButton,
  Input,
  Spinner,
  useToast,
} from "@/components/ui";
import { ApiError } from "@/shared/api";
import { IMAGE_ACCEPT, IMAGE_MAX_BYTES, IMAGE_TOO_LARGE, imageFileError } from "./imageFiles";
import {
  useDeleteCarImage,
  useReplaceCarImageFile,
  useUpdateCarImageAlt,
} from "./useAdminCarMedia";
import styles from "./AdminCarImages.module.css";

export interface AdminCarImageItemProps {
  carId: number;
  image: AdminCarImage;
  isFirst: boolean;
  isLast: boolean;
  /** Идёт смена порядка: стрелки у всех фото ждут ответа, порядок в кеше ещё старый. */
  reordering: boolean;
  onMove: (direction: -1 | 1) => void;
}

const LAST_IMAGE =
  "Это единственное фото опубликованного автомобиля — сначала снимите с публикации или загрузите другое";

/**
 * Одно фото в галерее админки (UC-A5 п.2). Свои хуки мутаций у каждого фото:
 * `isPending` у `useMutation` относится к последнему вызову, а здесь у каждого
 * фото своя блокировка — правка подписи одного не должна гасить кнопки другого.
 */
export function AdminCarImageItem({
  carId,
  image,
  isFirst,
  isLast,
  reordering,
  onMove,
}: AdminCarImageItemProps) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceFile = useReplaceCarImageFile(carId);
  const updateAlt = useUpdateCarImageAlt(carId);
  const deleteImage = useDeleteCarImage(carId);

  const [alt, setAlt] = useState(image.alt);
  const [altError, setAltError] = useState<string | null>(null);
  // Ошибка файла или удаления — у самого фото, а не тостом: тост не скажет, у какого
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const busy = replaceFile.isPending || updateAlt.isPending || deleteImage.isPending;
  const altChanged = alt !== image.alt;

  async function handleAltSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = carImageAltSchema.safeParse({ alt });
    if (!parsed.success) {
      setAltError(parsed.error.issues[0]?.message ?? "проверьте описание");
      return;
    }

    setAltError(null);
    try {
      const car = await updateAlt.mutateAsync({ imageId: image.id, alt: parsed.data.alt });
      // Сервер обрезал пробелы — поле показывает сохранённое, «изменений» нет
      setAlt(car.images.find((item) => item.id === image.id)?.alt ?? parsed.data.alt);
    } catch (cause) {
      setAltError(
        cause instanceof ApiError ? cause.message : "Не удалось сохранить. Попробуйте ещё раз.",
      );
      return;
    }
    toast({ tone: "success", description: "Описание фото сохранено" });
  }

  async function handleReplace(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Сброс сразу: иначе повторный выбор того же файла не вызовет change
    event.target.value = "";
    if (!file) return;

    if (file.size > IMAGE_MAX_BYTES) {
      setError(IMAGE_TOO_LARGE);
      return;
    }

    setError(null);
    try {
      await replaceFile.mutateAsync({ imageId: image.id, file });
    } catch (cause) {
      setError(imageFileError(cause));
      return;
    }
    toast({ tone: "success", description: "Файл фото заменён" });
  }

  async function handleDelete() {
    setError(null);
    try {
      await deleteImage.mutateAsync(image.id);
    } catch (cause) {
      setConfirmOpen(false);
      setError(
        cause instanceof ApiError && cause.is("LAST_IMAGE")
          ? LAST_IMAGE
          : "Не удалось удалить фото. Попробуйте ещё раз.",
      );
      return;
    }
    // Компонент сейчас пропадёт вместе с фото — тост показывает провайдер
    toast({ tone: "success", description: "Фото удалено" });
  }

  return (
    <li className={styles.item} aria-busy={busy || undefined}>
      <div className={styles.preview}>
        <img className={styles.image} src={image.path} alt={image.alt} loading="lazy" />
        {isFirst && (
          <Badge tone="info" className={styles.cover}>
            Обложка
          </Badge>
        )}
        {(replaceFile.isPending || deleteImage.isPending) && (
          <div className={styles.overlay}>
            <Spinner label={replaceFile.isPending ? "Заменяем файл" : "Удаляем фото"} />
          </div>
        )}
      </div>

      <div className={styles.body}>
        {error && <Alert variant="error">{error}</Alert>}

        <form className={styles.altForm} onSubmit={handleAltSubmit} noValidate>
          <Field label="Описание (alt)" required error={altError}>
            {(control) => (
              <Input
                {...control}
                autoComplete="off"
                maxLength={200}
                value={alt}
                disabled={busy}
                onChange={(event) => setAlt(event.target.value)}
              />
            )}
          </Field>
          <Button
            type="submit"
            size="sm"
            disabled={!altChanged || replaceFile.isPending || deleteImage.isPending}
            loading={updateAlt.isPending}
          >
            Сохранить
          </Button>
        </form>

        <div className={styles.controls}>
          <IconButton
            size="sm"
            label="Выше"
            icon={<ArrowUp aria-hidden="true" />}
            disabled={isFirst || busy || reordering}
            onClick={() => onMove(-1)}
          />
          <IconButton
            size="sm"
            label="Ниже"
            icon={<ArrowDown aria-hidden="true" />}
            disabled={isLast || busy || reordering}
            onClick={() => onMove(1)}
          />

          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_ACCEPT}
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void handleReplace(event)}
          />
          <Button
            size="sm"
            iconStart={<ImageUp aria-hidden="true" />}
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            Заменить файл
          </Button>

          <Button
            size="sm"
            variant="danger"
            iconStart={<Trash2 aria-hidden="true" />}
            disabled={busy}
            onClick={() => {
              setError(null);
              setConfirmOpen(true);
            }}
          >
            Удалить
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          title="Удалить фото?"
          description={
            isFirst
              ? "Это обложка: в каталоге её место займёт следующее фото. Действие необратимо."
              : "Фото будет удалено без возможности восстановить."
          }
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Отмена</Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={deleteImage.isPending}
                onClick={() => void handleDelete()}
              >
                Удалить
              </Button>
            </>
          }
        />
      </Dialog>
    </li>
  );
}
