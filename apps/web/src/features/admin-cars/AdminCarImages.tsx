import { useRef, useState, type ChangeEvent } from "react";
import { carImageAltSchema, type AdminCar } from "@carshowroom/contracts";
import { CircleCheck, Clock, ImagePlus, TriangleAlert } from "lucide-react";
import { Alert, Button, Field, Input, Spinner, useToast } from "@/components/ui";
import { AdminCarImageItem } from "./AdminCarImageItem";
import { IMAGE_ACCEPT, IMAGE_MAX_BYTES, IMAGE_TOO_LARGE, imageFileError } from "./imageFiles";
import { useReorderCarImages, useUploadCarImage } from "./useAdminCarMedia";
import styles from "./AdminCarImages.module.css";

export interface AdminCarImagesProps {
  car: AdminCar;
}

type QueueStatus = "waiting" | "uploading" | "done" | "error";

interface QueueItem {
  key: number;
  name: string;
  status: QueueStatus;
  error?: string;
}

const STATUS_LABELS: Record<Exclude<QueueStatus, "error">, string> = {
  waiting: "ожидает",
  uploading: "загружается",
  done: "готово",
};

/**
 * Фото автомобиля (UC-A5): галерея в порядке `position` и загрузка новых.
 *
 * Выбранные файлы уходят по одному: сервер ставит каждое фото в конец, и
 * параллельные запросы перемешали бы порядок. Ошибка одного файла
 * отмечается в очереди и не останавливает остальные. После пачки готовые
 * строки убираются — они уже видны в галерее, — а ошибки остаются, пока
 * не начнётся следующая загрузка.
 */
export function AdminCarImages({ car }: AdminCarImagesProps) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  // Ключ строки очереди: имя файла не уникально, а индекс сдвигается при уборке готовых
  const nextQueueKey = useRef(1);
  const upload = useUploadCarImage(car.id);
  const reorder = useReorderCarImages(car.id);

  const [alt, setAlt] = useState(car.name);
  const [altError, setAltError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  function updateItem(key: number, patch: Partial<QueueItem>) {
    setQueue((items) => items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function chooseFiles() {
    const parsed = carImageAltSchema.safeParse({ alt });
    if (!parsed.success) {
      setAltError(parsed.error.issues[0]?.message ?? "проверьте описание");
      return;
    }
    setAltError(null);
    fileInput.current?.click();
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    // Подпись проверена перед выбором файлов; trim — как сделала бы схема
    const imageAlt = alt.trim();
    const batch = files.map((file) => ({ file, key: nextQueueKey.current++ }));
    setQueue(batch.map(({ file, key }) => ({ key, name: file.name, status: "waiting" })));
    setUploading(true);

    let uploaded = 0;
    for (const { file, key } of batch) {
      if (file.size > IMAGE_MAX_BYTES) {
        updateItem(key, { status: "error", error: IMAGE_TOO_LARGE });
        continue;
      }
      updateItem(key, { status: "uploading" });
      try {
        await upload.mutateAsync({ file, alt: imageAlt });
        updateItem(key, { status: "done" });
        uploaded += 1;
      } catch (error) {
        updateItem(key, { status: "error", error: imageFileError(error) });
      }
    }

    setUploading(false);
    setQueue((items) => items.filter((item) => item.status === "error"));
    if (uploaded > 0) {
      toast({
        tone: "success",
        description: uploaded === 1 ? "Фото загружено" : `Загружено фото: ${uploaded}`,
      });
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const ids = car.images.map((image) => image.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];

    setReorderError(null);
    try {
      await reorder.mutateAsync({ imageIds: ids });
    } catch {
      setReorderError("Не удалось изменить порядок фото. Попробуйте ещё раз.");
    }
  }

  return (
    <div className={styles.root}>
      {car.images.length === 0 ? (
        <p className={styles.empty}>Фото пока нет. Без фото автомобиль нельзя опубликовать.</p>
      ) : (
        <>
          {reorderError && <Alert variant="error">{reorderError}</Alert>}
          <ol className={styles.list}>
            {car.images.map((image, index) => (
              <AdminCarImageItem
                key={image.id}
                carId={car.id}
                image={image}
                isFirst={index === 0}
                isLast={index === car.images.length - 1}
                reordering={reorder.isPending}
                onMove={(direction) => void move(index, direction)}
              />
            ))}
          </ol>
        </>
      )}

      <div className={styles.upload}>
        <h3 className={styles.uploadTitle}>Добавить фото</h3>
        <div className={styles.uploadRow}>
          <Field
            label="Описание фото (alt)"
            required
            error={altError}
            hint="Подпись получат все выбранные файлы; у каждого её можно поправить потом"
            className={styles.uploadField}
          >
            {(control) => (
              <Input
                {...control}
                autoComplete="off"
                maxLength={200}
                value={alt}
                disabled={uploading}
                onChange={(event) => setAlt(event.target.value)}
              />
            )}
          </Field>

          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void handleFiles(event)}
          />
          <Button
            variant="primary"
            iconStart={<ImagePlus aria-hidden="true" />}
            loading={uploading}
            onClick={chooseFiles}
          >
            Выбрать файлы
          </Button>
        </div>
        <p className={styles.hint}>
          JPEG, PNG, WebP или AVIF, до 10 МБ. Новые фото встают в конец.
        </p>

        {queue.length > 0 && (
          <ul className={styles.queue} aria-live="polite">
            {queue.map((item) => (
              <li key={item.key} className={styles.queueItem} data-status={item.status}>
                <span className={styles.queueIcon}>
                  {item.status === "uploading" ? (
                    <Spinner size="sm" label={null} />
                  ) : item.status === "done" ? (
                    <CircleCheck aria-hidden="true" />
                  ) : item.status === "error" ? (
                    <TriangleAlert aria-hidden="true" />
                  ) : (
                    <Clock aria-hidden="true" />
                  )}
                </span>
                <span className={styles.queueName}>{item.name}</span>
                <span className={styles.queueStatus}>
                  {item.status === "error" ? item.error : STATUS_LABELS[item.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
