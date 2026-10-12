import { useId, useState, type FormEvent } from "react";
import {
  createAdminCarSchema,
  driveTypes,
  type AdminCar,
  type AdminCarOptions,
  type CreateAdminCar,
  type DriveType,
  type UpdateAdminCar,
} from "@carshowroom/contracts";
import { TriangleAlert } from "lucide-react";
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
  type SelectOption,
} from "@/components/ui";
import { ApiError } from "@/shared/api";
import { fieldErrors, type FieldErrors } from "@/shared/form";
import { useCreateAdminCar, useUpdateAdminCar } from "./useAdminCars";
import styles from "./AdminCarForm.module.css";

export interface AdminCarFormProps {
  options: AdminCarOptions;
  /** Есть — редактирование этой карточки; нет — создание черновика. */
  car?: AdminCar;
  /** Черновик создан: странице пора уйти на его адрес. */
  onCreated?: (car: AdminCar) => void;
}

type FormField = keyof CreateAdminCar;
type TextField = Exclude<FormField, "colorIds">;

/**
 * Состояние формы: всё, что вводится руками, — строки, как их отдают
 * инпуты. В числа они превращаются только перед схемой контракта.
 */
type FormValues = Record<TextField, string> & { colorIds: number[] };

const TEXT_FIELDS: TextField[] = [
  "name",
  "slug",
  "seriesId",
  "bodyTypeId",
  "fuelTypeId",
  "driveType",
  "modelYear",
  "description",
  "powerHp",
  "accelerationS",
  "topSpeedKmh",
  "price",
];

const FORM_FIELDS = new Set<string>([...TEXT_FIELDS, "colorIds"]);

/**
 * Пустое поле получает «укажите …», а не сообщение схемы: у пустого года
 * zod сказал бы про NaN, у пустого slug — про латиницу, а у невыбранной
 * серии — про undefined. Человеку нужно другое: что поле не заполнено.
 */
const EMPTY_MESSAGES: Record<TextField, string> = {
  name: "укажите название",
  slug: "укажите slug",
  seriesId: "выберите серию",
  bodyTypeId: "выберите кузов",
  fuelTypeId: "выберите тип двигателя",
  driveType: "выберите привод",
  modelYear: "укажите год",
  description: "укажите описание",
  powerHp: "укажите мощность",
  accelerationS: "укажите разгон",
  topSpeedKmh: "укажите скорость",
  price: "укажите цену",
};

type IntegerField = "modelYear" | "powerHp" | "topSpeedKmh";

const NOT_A_NUMBER: Record<IntegerField, string> = {
  modelYear: "год — целое число",
  powerHp: "мощность — целое число",
  topSpeedKmh: "скорость — целое число",
};

/**
 * Подписи привода. Общего словаря нет: каталог держит свои короткие
 * подписи для фильтра и карточки, а админке нужны однозначные — с кодом
 * привода, который админ видит в данных.
 */
const DRIVE_LABELS: Record<DriveType, string> = {
  rwd: "Задний (RWD)",
  xdrive: "Полный (xDrive)",
};

const DRIVE_OPTIONS: SelectOption[] = driveTypes.map((drive) => ({
  value: drive,
  label: DRIVE_LABELS[drive],
}));

const REQUEST_FAILED = "Не удалось сохранить автомобиль. Попробуйте ещё раз.";

const EMPTY_VALUES: FormValues = {
  name: "",
  slug: "",
  seriesId: "",
  bodyTypeId: "",
  fuelTypeId: "",
  driveType: "",
  modelYear: "",
  description: "",
  powerHp: "",
  accelerationS: "",
  topSpeedKmh: "",
  price: "",
  colorIds: [],
};

/**
 * Карточка → поля формы. Копейки `.00` у цены отрезаются: numeric(12,2)
 * приходит как «4500000.00», а в поле удобнее «4500000» — значение то же,
 * и сравнение «что изменилось» идёт по этим же строкам с обеих сторон.
 */
function toValues(car: AdminCar): FormValues {
  return {
    name: car.name,
    slug: car.slug,
    seriesId: String(car.seriesId),
    bodyTypeId: String(car.bodyTypeId),
    fuelTypeId: String(car.fuelTypeId),
    driveType: car.driveType,
    modelYear: String(car.modelYear),
    description: car.description,
    powerHp: String(car.powerHp),
    accelerationS: car.accelerationS,
    topSpeedKmh: String(car.topSpeedKmh),
    price: car.price.replace(/\.00$/, ""),
    colorIds: car.colorIds,
  };
}

/** Палитра — множество: порядок отметок не делает её другой. */
function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

function changedFields(values: FormValues, baseline: FormValues): FormField[] {
  const changed: FormField[] = TEXT_FIELDS.filter((key) => values[key] !== baseline[key]);
  if (!sameIds(values.colorIds, baseline.colorIds)) changed.push("colorIds");
  return changed;
}

/** Пустая строка — «не указано»; с остальным разбирается схема. */
function toNumber(raw: string): number | undefined {
  const value = raw.trim();
  return value === "" ? undefined : Number(value);
}

/**
 * «4 500 000» и «4,9» — так число набирают по-русски; схема ждёт
 * «4500000» и «4.9». Пробелы и запятую чиним здесь, остальное проверяет
 * контракт.
 */
function toDecimal(raw: string): string {
  return raw.replace(/\s/g, "").replace(",", ".");
}

type Validation =
  { ok: true; data: CreateAdminCar } | { ok: false; errors: FieldErrors<FormField> };

/**
 * Полная проверка схемой контракта — и при создании, и при правке: в форме
 * всегда все поля, и показывать ошибку у поля, которое не трогали, честнее,
 * чем получить её от сервера.
 */
function validate(values: FormValues): Validation {
  const own: FieldErrors<FormField> = {};
  for (const key of TEXT_FIELDS) {
    if (values[key].trim() === "") own[key] = EMPTY_MESSAGES[key];
  }

  const numbers: Record<IntegerField, number | undefined> = {
    modelYear: toNumber(values.modelYear),
    powerHp: toNumber(values.powerHp),
    topSpeedKmh: toNumber(values.topSpeedKmh),
  };
  for (const key of Object.keys(numbers) as IntegerField[]) {
    if (Number.isNaN(numbers[key]) && own[key] === undefined) own[key] = NOT_A_NUMBER[key];
  }

  const parsed = createAdminCarSchema.safeParse({
    name: values.name,
    slug: values.slug,
    seriesId: toNumber(values.seriesId),
    bodyTypeId: toNumber(values.bodyTypeId),
    fuelTypeId: toNumber(values.fuelTypeId),
    driveType: values.driveType || undefined,
    modelYear: numbers.modelYear,
    description: values.description,
    powerHp: numbers.powerHp,
    accelerationS: toDecimal(values.accelerationS),
    topSpeedKmh: numbers.topSpeedKmh,
    price: toDecimal(values.price),
    colorIds: values.colorIds,
  });

  // Свои сообщения важнее: на пустом поле схема говорит не по делу
  const errors = { ...(parsed.success ? {} : fieldErrors<FormField>(parsed.error)), ...own };
  if (!parsed.success || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: parsed.data };
}

/** Только изменённые поля: PATCH не перезаписывает то, чего админ не касался. */
function pick(data: CreateAdminCar, keys: FormField[]): UpdateAdminCar {
  return Object.fromEntries(keys.map((key) => [key, data[key]])) as UpdateAdminCar;
}

/**
 * Ответ сервера → сообщения у полей. Занятые slug и название — 409 со
 * своим кодом; 400 `VALIDATION_FAILED` приходит либо списком zod-ошибок
 * (`details.issues`, разбор тела), либо одним полем (`details.field` —
 * например, серии с таким id уже нет). Всё, что к полю не привязать, —
 * общая плашка над кнопками.
 */
function serverErrors(error: unknown): { fields: FieldErrors<FormField> } | { alert: string } {
  if (!(error instanceof ApiError)) return { alert: REQUEST_FAILED };

  if (error.is("SLUG_TAKEN")) return { fields: { slug: "Такой slug уже занят" } };
  if (error.is("NAME_TAKEN")) {
    return { fields: { name: "Автомобиль с таким названием уже есть" } };
  }

  if (error.is("VALIDATION_FAILED")) {
    const fields: FieldErrors<FormField> = {};
    const { field, issues } = error.details ?? {};

    if (typeof field === "string" && FORM_FIELDS.has(field)) {
      fields[field as FormField] = error.message;
    }
    if (Array.isArray(issues)) {
      for (const issue of issues as { path?: unknown[]; message?: unknown }[]) {
        const key = issue.path?.[0];
        if (typeof key === "string" && FORM_FIELDS.has(key) && typeof issue.message === "string") {
          fields[key as FormField] ??= issue.message;
        }
      }
    }

    if (Object.keys(fields).length > 0) return { fields };
    return { alert: error.message };
  }

  return { alert: REQUEST_FAILED };
}

/**
 * Предложение slug из названия: латиница и цифры в нижнем регистре,
 * всё остальное — дефис. Транслитерации нет: названия машин и так
 * латиницей («BMW M5 Competition» → «bmw-m5-competition»).
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toOptions(items: { id: number; name: string }[]): SelectOption[] {
  return items.map((item) => ({ value: String(item.id), label: item.name }));
}

/**
 * Поля карточки автомобиля (UC-A3) — одна форма на создание и правку.
 *
 * Запрос делает сама форма: разбор ответа (ошибки у полей, синхронизация
 * с сохранённым) у обоих режимов один, а странице остаётся только решить,
 * куда идти после создания.
 *
 * При правке состояние полей живёт отдельно от карточки в кеше: загрузка
 * фото тоже кладёт в кеш новую карточку, и недописанные правки от этого
 * пропадать не должны. «Изменено» считается против текущей карточки,
 * а после сохранения поля берутся из ответа сервера.
 */
export function AdminCarForm({ options, car, onCreated }: AdminCarFormProps) {
  const toast = useToast();
  const colorsHintId = useId();
  const createCar = useCreateAdminCar();
  // В режиме создания хук стоит вхолостую: условно вызывать хуки нельзя,
  // а мутация без вызова mutate запросов не делает.
  const updateCar = useUpdateAdminCar(car?.id ?? 0);

  const [values, setValues] = useState<FormValues>(() => (car ? toValues(car) : EMPTY_VALUES));
  const [errors, setErrors] = useState<FieldErrors<FormField>>({});
  const [alert, setAlert] = useState<string | null>(null);
  // Пока админ сам не правил slug, он идёт следом за названием (только при создании)
  const [slugTouched, setSlugTouched] = useState(car !== undefined);

  const changed = car ? changedFields(values, toValues(car)) : [];
  const pending = createCar.isPending || updateCar.isPending;

  function set<K extends TextField>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setName(name: string) {
    setValues((current) => ({
      ...current,
      name,
      slug: slugTouched ? current.slug : slugify(name),
    }));
  }

  function toggleColor(id: number, checked: boolean) {
    setValues((current) => ({
      ...current,
      colorIds: checked
        ? [...current.colorIds, id]
        : current.colorIds.filter((colorId) => colorId !== id),
    }));
  }

  function reset() {
    if (car) setValues(toValues(car));
    setErrors({});
    setAlert(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = validate(values);
    if (!result.ok) {
      setAlert(null);
      setErrors(result.errors);
      return;
    }

    setErrors({});
    setAlert(null);

    let saved: AdminCar;
    try {
      saved = car
        ? await updateCar.mutateAsync(pick(result.data, changed))
        : await createCar.mutateAsync(result.data);
    } catch (error) {
      const parsed = serverErrors(error);
      if ("fields" in parsed) setErrors(parsed.fields);
      else setAlert(parsed.alert);
      return;
    }

    if (car) {
      // Сервер мог нормализовать ввод (обрезать пробелы, дописать копейки) —
      // поля показывают то, что сохранено, и «изменений» после этого нет
      setValues(toValues(saved));
      toast({ tone: "success", description: "Сохранено" });
    } else {
      toast({ tone: "success", description: "Черновик создан" });
      onCreated?.(saved);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Основное</legend>

        <div className={styles.grid}>
          <Field label="Название" required error={errors.name}>
            {(control) => (
              <Input
                {...control}
                name="name"
                autoComplete="off"
                maxLength={100}
                value={values.name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>

          <Field
            label="Slug"
            required
            error={errors.slug}
            hint={`Адрес на сайте: /catalog/${values.slug || "…"}`}
          >
            {(control) => (
              <Input
                {...control}
                name="slug"
                autoComplete="off"
                spellCheck={false}
                maxLength={100}
                value={values.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  set("slug", event.target.value);
                }}
              />
            )}
          </Field>

          <Field label="Серия" required error={errors.seriesId}>
            {(control) => (
              <Select
                {...control}
                options={toOptions(options.series)}
                placeholder="Выберите серию"
                value={values.seriesId}
                onValueChange={(value) => set("seriesId", value)}
              />
            )}
          </Field>

          <Field label="Кузов" required error={errors.bodyTypeId}>
            {(control) => (
              <Select
                {...control}
                options={toOptions(options.bodyTypes)}
                placeholder="Выберите кузов"
                value={values.bodyTypeId}
                onValueChange={(value) => set("bodyTypeId", value)}
              />
            )}
          </Field>

          <Field label="Тип двигателя" required error={errors.fuelTypeId}>
            {(control) => (
              <Select
                {...control}
                options={toOptions(options.fuelTypes)}
                placeholder="Выберите тип"
                value={values.fuelTypeId}
                onValueChange={(value) => set("fuelTypeId", value)}
              />
            )}
          </Field>

          <Field label="Привод" required error={errors.driveType}>
            {(control) => (
              <Select
                {...control}
                options={DRIVE_OPTIONS}
                placeholder="Выберите привод"
                value={values.driveType}
                onValueChange={(value) => set("driveType", value)}
              />
            )}
          </Field>

          <Field label="Год" required error={errors.modelYear}>
            {(control) => (
              <Input
                {...control}
                name="modelYear"
                inputMode="numeric"
                autoComplete="off"
                value={values.modelYear}
                onChange={(event) => set("modelYear", event.target.value)}
              />
            )}
          </Field>

          <Field label="Описание" required error={errors.description} className={styles.wide}>
            {(control) => (
              <Textarea
                {...control}
                name="description"
                rows={6}
                maxLength={5000}
                showCount
                value={values.description}
                onChange={(event) => set("description", event.target.value)}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Характеристики и цена</legend>

        <div className={styles.grid}>
          <Field label="Мощность, л.с." required error={errors.powerHp}>
            {(control) => (
              <Input
                {...control}
                name="powerHp"
                inputMode="numeric"
                autoComplete="off"
                value={values.powerHp}
                onChange={(event) => set("powerHp", event.target.value)}
              />
            )}
          </Field>

          <Field label="Разгон 0–100, с" required error={errors.accelerationS} hint="Например, 4.9">
            {(control) => (
              <Input
                {...control}
                name="accelerationS"
                inputMode="decimal"
                autoComplete="off"
                value={values.accelerationS}
                onChange={(event) => set("accelerationS", event.target.value)}
              />
            )}
          </Field>

          <Field label="Макс. скорость, км/ч" required error={errors.topSpeedKmh}>
            {(control) => (
              <Input
                {...control}
                name="topSpeedKmh"
                inputMode="numeric"
                autoComplete="off"
                value={values.topSpeedKmh}
                onChange={(event) => set("topSpeedKmh", event.target.value)}
              />
            )}
          </Field>

          <Field label="Цена, ₽" required error={errors.price} hint="Например, 12500000">
            {(control) => (
              <Input
                {...control}
                name="price"
                inputMode="decimal"
                autoComplete="off"
                value={values.price}
                onChange={(event) => set("price", event.target.value)}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className={styles.group} aria-describedby={colorsHintId}>
        <legend className={styles.legend}>Палитра</legend>
        <p id={colorsHintId} className={styles.hint}>
          Цвета, в которые можно перекрасить 3D-модель. Можно не выбирать.
        </p>

        {options.colors.length === 0 ? (
          <p className={styles.hint}>В справочнике пока нет цветов.</p>
        ) : (
          <div className={styles.colors}>
            {options.colors.map((color) => (
              <Checkbox
                key={color.id}
                checked={values.colorIds.includes(color.id)}
                onCheckedChange={(checked) => toggleColor(color.id, checked)}
                invalid={Boolean(errors.colorIds)}
              >
                <span className={styles.color}>
                  {/* Цвет — данные справочника, а не оформление: inline-стиль */}
                  <span
                    aria-hidden="true"
                    className={styles.swatch}
                    style={{ backgroundColor: color.hex }}
                  />
                  {color.name}
                </span>
              </Checkbox>
            ))}
          </div>
        )}

        {errors.colorIds && (
          <span className={styles.error}>
            <TriangleAlert aria-hidden="true" />
            {errors.colorIds}
          </span>
        )}
      </fieldset>

      {alert && <Alert variant="error">{alert}</Alert>}

      <div className={styles.actions}>
        {car ? (
          <>
            <Button variant="ghost" disabled={changed.length === 0 || pending} onClick={reset}>
              Отменить изменения
            </Button>
            {/* Пустой PATCH API отклонит («нечего сохранять») — без правок кнопка неактивна */}
            <Button
              type="submit"
              variant="primary"
              disabled={changed.length === 0}
              loading={pending}
            >
              Сохранить
            </Button>
          </>
        ) : (
          <Button type="submit" variant="primary" loading={pending}>
            Создать
          </Button>
        )}
      </div>
    </form>
  );
}

/** Пока грузятся справочники (и карточка): контуры полей формы. */
export function AdminCarFormSkeleton() {
  return (
    <div className={styles.form} aria-busy="true">
      {[8, 4].map((count, group) => (
        <div key={group} className={styles.group}>
          <Skeleton variant="title" width="30%" />
          <div className={styles.grid}>
            {Array.from({ length: count }, (_, index) => (
              <div key={index} className={styles.skeletonField}>
                <Skeleton width="40%" />
                <Skeleton variant="block" height="var(--control-height)" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
