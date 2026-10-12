import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CircleSlash, ExternalLink } from "lucide-react";
import { Badge, Button, Skeleton, StatePanel } from "@/components/ui";
import {
  AdminCarActions,
  AdminCarForm,
  AdminCarFormSkeleton,
  AdminCarImages,
  AdminCarModel,
  useAdminCar,
  useAdminCarOptions,
} from "@/features/admin-cars";
import { ApiError } from "@/shared/api";
import { LinkButton } from "@/shared/ui/LinkButton";
import styles from "./CarEditPage.module.css";

const LIST_PATH = "/admin/cars";

/** `:id` из адреса — только положительное целое; иначе карточки заведомо нет. */
function parseId(raw: string | undefined): number | undefined {
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.is("NOT_FOUND");
}

function BackLink() {
  return (
    <LinkButton
      to={LIST_PATH}
      variant="ghost"
      size="sm"
      iconStart={<ArrowLeft aria-hidden="true" />}
      className={styles.back}
    >
      Автомобили
    </LinkButton>
  );
}

/**
 * Карточка автомобиля в админке — UC-A3 п.3, UC-A4.
 *
 * Сверху — название, статус и действия (публикация, удаление), ниже
 * секциями: поля карточки, фото (UC-A5), 3D-модель (UC-A6). Секции идут
 * одной колонкой: у формы и медиа свои внутренние сетки, а рядом друг
 * с другом им тесно на любой ширине, кроме очень широкой.
 */
export default function CarEditPage() {
  const params = useParams<{ id: string }>();
  const id = parseId(params.id);
  const navigate = useNavigate();
  const car = useAdminCar(id);
  const options = useAdminCarOptions();

  if (id === undefined || (car.isError && isNotFound(car.error))) {
    return (
      <div className={styles.page}>
        <StatePanel
          icon={<CircleSlash aria-hidden="true" />}
          title="Автомобиль не найден"
          description="Возможно, его удалили или в ссылке ошибка."
          action={<LinkButton to={LIST_PATH}>К списку автомобилей</LinkButton>}
        />
      </div>
    );
  }

  if (car.isError || options.isError) {
    const retry = () => {
      if (car.isError) void car.refetch();
      if (options.isError) void options.refetch();
    };
    return (
      <div className={styles.page}>
        <BackLink />
        <StatePanel
          variant="error"
          title="Не удалось загрузить автомобиль"
          description="Проверьте соединение и попробуйте снова."
          action={
            <Button
              variant="primary"
              loading={car.isFetching || options.isFetching}
              onClick={retry}
            >
              Повторить
            </Button>
          }
        />
      </div>
    );
  }

  if (car.isPending || options.isPending) {
    return (
      <div className={styles.page} aria-busy="true">
        <BackLink />
        <div className={styles.head}>
          <Skeleton variant="title" width="50%" />
          <Skeleton width="20%" />
        </div>
        <AdminCarFormSkeleton />
      </div>
    );
  }

  const data = car.data;

  return (
    <div className={styles.page}>
      <BackLink />

      <header className={styles.head}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{data.name}</h1>
          <span className={styles.badges}>
            {data.isPublished ? (
              <Badge tone="success" dot>
                Опубликован
              </Badge>
            ) : (
              <Badge dot>Черновик</Badge>
            )}
            {data.model && <Badge tone="info">3D</Badge>}
          </span>
        </div>

        {/* Публичная страница есть только у опубликованного: черновик там — 404 */}
        {data.isPublished && (
          <LinkButton
            to={`/catalog/${data.slug}`}
            variant="ghost"
            size="sm"
            iconEnd={<ExternalLink aria-hidden="true" />}
            className={styles.siteLink}
          >
            Открыть на сайте
          </LinkButton>
        )}

        <AdminCarActions car={data} onDeleted={() => navigate(LIST_PATH, { replace: true })} />
      </header>

      <section className={styles.section} aria-labelledby="car-fields-title">
        <h2 id="car-fields-title" className={styles.sectionTitle}>
          Карточка
        </h2>
        {/* Ключ по id: переход на другую машину начинает форму с её данных */}
        <AdminCarForm key={data.id} options={options.data} car={data} />
      </section>

      <section className={styles.section} aria-labelledby="car-images-title">
        <h2 id="car-images-title" className={styles.sectionTitle}>
          Фото
        </h2>
        <AdminCarImages key={data.id} car={data} />
      </section>

      <section className={styles.section} aria-labelledby="car-model-title">
        <h2 id="car-model-title" className={styles.sectionTitle}>
          3D-модель
        </h2>
        <AdminCarModel key={data.id} car={data} />
      </section>
    </div>
  );
}
