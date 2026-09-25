import { Skeleton } from "@/components/ui";
import styles from "./CarCardSkeleton.module.css";

/**
 * Заглушка карточки на время загрузки — повторяет коробочную модель
 * горизонтальной `CarCard` (фото слева, строки текста справа), иначе сетка
 * прыгает в момент подстановки данных.
 *
 * Фото — не `Skeleton`, а свой класс с той же анимацией: у примитива высота
 * приходит от `data-variant` и специфичность спорит с раскладкой карточки
 * (порядок CSS-модулей в бандле не гарантирован, см. `CatalogPage.module.css`
 * про подошву диалога). Собственный класс такого конфликта не создаёт.
 */
export function CarCardSkeleton() {
  return (
    <div className={styles.card}>
      <span aria-hidden="true" className={styles.photo} />

      <div className={styles.body}>
        <Skeleton variant="title" width="70%" />
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="50%" />
      </div>
    </div>
  );
}
