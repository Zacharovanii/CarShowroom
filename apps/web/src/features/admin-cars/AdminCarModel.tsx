import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { carModelFieldsSchema, type AdminCar } from "@carshowroom/contracts";
import { Box, Trash2, Upload } from "lucide-react";
import {
  Alert,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Field,
  Input,
  Spinner,
  useToast,
} from "@/components/ui";
import { ApiError, NetworkError } from "@/shared/api";
import { useDeleteCarModel, useUploadCarModel } from "./useAdminCarMedia";
import styles from "./AdminCarModel.module.css";

export interface AdminCarModelProps {
  car: AdminCar;
}

const MODEL_ACCEPT = ".glb,model/gltf-binary";

/**
 * Лимит GLB — как `MODEL_MAX_BYTES` в API. Предпроверка лишь не гонит по сети
 * заведомо лишние десятки мегабайт; источник истины — 413 сервера.
 */
const MODEL_MAX_BYTES = 60 * 1024 * 1024;
const MODEL_TOO_LARGE = "Файл больше 60 МБ";

/** Что показать после неудачной загрузки: у файла, у поля материала или плашкой. */
type UploadError =
  { kind: "file"; message: string } | { kind: "material"; material: string; materials: string[] };

function uploadError(error: unknown, material: string): UploadError {
  if (error instanceof ApiError) {
    if (error.is("PAINT_MATERIAL_NOT_FOUND")) {
      const raw = error.details?.materials;
      const materials = Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === "string")
        : [];
      return { kind: "material", material, materials };
    }
    if (error.is("INVALID_FILE"))
      return { kind: "file", message: "Файл не похож на GLB (glTF 2.0)" };
    if (error.is("FILE_TOO_LARGE")) return { kind: "file", message: MODEL_TOO_LARGE };
    return { kind: "file", message: error.message };
  }
  if (error instanceof NetworkError) return { kind: "file", message: error.message };
  return { kind: "file", message: "Не удалось загрузить модель. Попробуйте ещё раз." };
}

/** `/media/models/7/….glb` → `….glb`: путь целиком нужен редко, имя — всегда. */
function fileName(path: string): string {
  return path.split("/").pop() || path;
}

/**
 * 3D-модель автомобиля (UC-A6): текущий GLB, загрузка или замена с именем
 * материала краски и удаление.
 *
 * Материал проверяет сервер по самому файлу. Если такого нет, он присылает
 * список материалов модели — они становятся кнопками: клик подставляет имя
 * в поле, а выбранный файл остаётся, и можно сразу загрузить снова.
 */
export function AdminCarModel({ car }: AdminCarModelProps) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadModel = useUploadCarModel(car.id);
  const deleteModel = useDeleteCarModel(car.id);

  const [file, setFile] = useState<File | null>(null);
  const [paintMaterial, setPaintMaterial] = useState(car.model?.paintMaterial ?? "CarPaint");
  const [fileError, setFileError] = useState<string | null>(null);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<string[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const pending = uploadModel.isPending;
  const model = car.model;

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setFileError(null);
    setMaterials(null);
  }

  function pickMaterial(name: string) {
    setPaintMaterial(name);
    setMaterialError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = carModelFieldsSchema.safeParse({ paintMaterial });
    const ownMaterialError = parsed.success
      ? null
      : (parsed.error.issues[0]?.message ?? "проверьте материал");
    setMaterialError(ownMaterialError);
    setFileError(file ? null : "выберите GLB-файл");
    if (!file || !parsed.success) return;

    if (file.size > MODEL_MAX_BYTES) {
      setFileError(MODEL_TOO_LARGE);
      return;
    }

    setMaterials(null);
    try {
      await uploadModel.mutateAsync({ file, paintMaterial: parsed.data.paintMaterial });
    } catch (error) {
      const parsedError = uploadError(error, parsed.data.paintMaterial);
      if (parsedError.kind === "material") {
        setMaterialError(`В модели нет материала «${parsedError.material}»`);
        setMaterials(parsedError.materials);
      } else {
        setFileError(parsedError.message);
      }
      return;
    }

    toast({ tone: "success", description: model ? "Модель заменена" : "Модель загружена" });
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteModel.mutateAsync();
    } catch {
      setDeleteError("Не удалось удалить модель. Попробуйте ещё раз.");
      return;
    }
    setConfirmOpen(false);
    toast({ tone: "success", description: "Модель удалена — вкладки 3D больше нет" });
  }

  return (
    <div className={styles.root}>
      {model ? (
        <div className={styles.current}>
          <Box aria-hidden="true" className={styles.icon} />
          <div className={styles.info}>
            <span className={styles.name}>{fileName(model.path)}</span>
            <span className={styles.path}>{model.path}</span>
            <span className={styles.material}>
              Материал краски: <strong>{model.paintMaterial}</strong>
            </span>
          </div>
          <Button
            size="sm"
            variant="danger"
            iconStart={<Trash2 aria-hidden="true" />}
            disabled={pending}
            onClick={() => {
              setDeleteError(null);
              setConfirmOpen(true);
            }}
            className={styles.delete}
          >
            Удалить модель
          </Button>
        </div>
      ) : (
        <p className={styles.empty}>
          3D-модели нет — вкладка 3D на странице автомобиля не показывается.
        </p>
      )}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h3 className={styles.formTitle}>{model ? "Заменить модель" : "Загрузить модель"}</h3>

        <Field label="GLB-файл" required error={fileError} hint="glTF 2.0 в формате .glb, до 60 МБ">
          {(control) => (
            <input
              id={control.id}
              aria-describedby={control["aria-describedby"]}
              aria-invalid={control.invalid || undefined}
              ref={fileInput}
              type="file"
              accept={MODEL_ACCEPT}
              disabled={pending}
              className={styles.file}
              onChange={handleFile}
            />
          )}
        </Field>

        <Field
          label="Материал краски"
          required
          error={materialError}
          hint="Материал кузова в модели: его 3D-просмотр перекрашивает в цвета палитры"
        >
          {(control) => (
            <Input
              {...control}
              autoComplete="off"
              maxLength={100}
              value={paintMaterial}
              disabled={pending}
              onChange={(event) => pickMaterial(event.target.value)}
            />
          )}
        </Field>

        {materials && (
          <div className={styles.materials}>
            {materials.length > 0 ? (
              <>
                <span className={styles.materialsLabel} id="car-model-materials">
                  Выберите один из материалов модели:
                </span>
                <div className={styles.chips} role="group" aria-labelledby="car-model-materials">
                  {materials.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={styles.chip}
                      aria-pressed={name === paintMaterial}
                      onClick={() => pickMaterial(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <span className={styles.materialsLabel}>
                В модели нет ни одного материала — перекрашивать нечего, нужен другой файл.
              </span>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <Button
            type="submit"
            variant="primary"
            iconStart={<Upload aria-hidden="true" />}
            loading={pending}
          >
            {model ? "Заменить" : "Загрузить"}
          </Button>
          {pending && (
            <span className={styles.progress}>
              <Spinner size="sm" label={null} />
              Загрузка… модель может весить до 60 МБ
            </span>
          )}
        </div>
      </form>

      <ul className={styles.notes}>
        <li>
          У опубликованного автомобиля с моделью сразу появляется вкладка 3D на странице автомобиля.
        </li>
        {model && car.colorIds.length === 0 && (
          <li>
            Палитра пуста — в 3D-просмотре будет только исходный цвет модели. Цвета отмечаются в
            карточке выше.
          </li>
        )}
      </ul>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          title="Удалить 3D-модель?"
          description="Вкладка 3D пропадёт со страницы автомобиля, фото останутся. Файл модели будет удалён."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Отмена</Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={deleteModel.isPending}
                onClick={() => void handleDelete()}
              >
                Удалить
              </Button>
            </>
          }
        >
          {deleteError && <Alert variant="error">{deleteError}</Alert>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
