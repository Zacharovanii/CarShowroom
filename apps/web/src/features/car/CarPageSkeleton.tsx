import { Skeleton } from "@/components/ui";
import styles from "./CarPageSkeleton.module.css";

/**
 * Загрузка страницы автомобиля: заглушки повторяют раскладку страницы —
 * строку «В каталог» с вкладками, кадр 3:2, ленту миниатюр, шапку и ряд
 * характеристик, — чтобы при подстановке данных ничего не прыгало.
 * Занятость сообщает контейнер через `aria-busy`, у заглушек содержимого
 * для скринридера нет.
 */
export function CarPageSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <div className={styles.bar}>
        <Skeleton variant="text" className={styles.back} />
        <Skeleton variant="text" className={styles.tab} />
        <Skeleton variant="text" className={styles.tabShort} />
      </div>

      <div className={styles.media}>
        <Skeleton ratio="3 / 2" className={styles.frame} />
        <div className={styles.thumbs}>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} ratio="3 / 2" className={styles.thumb} />
          ))}
        </div>
      </div>

      <div className={styles.head}>
        <Skeleton variant="title" width="60%" />
        <Skeleton variant="text" width="30%" />
        <Skeleton variant="title" width="40%" />
        <Skeleton variant="block" className={styles.button} />
      </div>

      <div className={styles.specs}>
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} variant="title" className={styles.spec} />
        ))}
      </div>
    </div>
  );
}
