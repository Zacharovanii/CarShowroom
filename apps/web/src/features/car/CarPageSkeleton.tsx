import { Skeleton } from "@/components/ui";
import styles from "./CarPageSkeleton.module.css";

/**
 * Загрузка страницы автомобиля: заглушки галереи и характеристик.
 * Занятость сообщает контейнер через `aria-busy`, поэтому у самих
 * заглушек содержимого для скринридера нет.
 */
export function CarPageSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <div className={styles.media}>
        <Skeleton ratio="3 / 2" />
        <div className={styles.thumbs}>
          <Skeleton ratio="3 / 2" className={styles.thumb} />
          <Skeleton ratio="3 / 2" className={styles.thumb} />
        </div>
      </div>

      <div className={styles.head}>
        <Skeleton variant="title" width="70%" />
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="title" width="50%" />
        <Skeleton variant="block" />
      </div>

      <div className={styles.specs}>
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} variant="title" />
        ))}
      </div>
    </div>
  );
}
