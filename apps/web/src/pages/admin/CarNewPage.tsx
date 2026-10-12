import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button, StatePanel } from "@/components/ui";
import { AdminCarForm, AdminCarFormSkeleton, useAdminCarOptions } from "@/features/admin-cars";
import { LinkButton } from "@/shared/ui/LinkButton";
import styles from "./CarNewPage.module.css";

/**
 * Новый автомобиль — UC-A3 п.2. Создаётся черновиком: в каталог он попадёт
 * только после фото и публикации, которые делаются уже на странице правки.
 * Поэтому после «Создать» — переход туда с заменой адреса: «Назад» из
 * карточки ведёт в список, а не в пустую форму создания.
 */
export default function CarNewPage() {
  const navigate = useNavigate();
  const options = useAdminCarOptions();

  return (
    <div className={styles.page}>
      <LinkButton
        to="/admin/cars"
        variant="ghost"
        size="sm"
        iconStart={<ArrowLeft aria-hidden="true" />}
        className={styles.back}
      >
        Автомобили
      </LinkButton>

      <header className={styles.head}>
        <h1 className={styles.title}>Новый автомобиль</h1>
        <p className={styles.lead}>
          Сохранится черновиком. Фото, 3D-модель и публикация — после создания.
        </p>
      </header>

      {options.isError ? (
        <StatePanel
          variant="error"
          title="Не удалось загрузить справочники"
          description="Без серий, кузовов и цветов форму не заполнить. Проверьте соединение и попробуйте снова."
          action={
            <Button
              variant="primary"
              loading={options.isFetching}
              onClick={() => options.refetch()}
            >
              Повторить
            </Button>
          }
        />
      ) : options.isPending ? (
        <AdminCarFormSkeleton />
      ) : (
        <AdminCarForm
          options={options.data}
          onCreated={(car) => navigate(`/admin/cars/${car.id}`, { replace: true })}
        />
      )}
    </div>
  );
}
