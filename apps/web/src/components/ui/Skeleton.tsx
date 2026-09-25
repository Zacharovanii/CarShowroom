import clsx from "clsx";
import styles from "./Skeleton.module.css";

export type SkeletonVariant = "text" | "title" | "block" | "card";

export interface SkeletonProps {
  variant?: SkeletonVariant;
  /** Ширина в процентах: `"60%"`. Пиксели сюда не передаём — сетка своя. */
  width?: string;
  /**
   * Пропорция вместо высоты варианта: `"3 / 2"`. Нужна заглушкам кадра
   * и миниатюры — они держат форму снимка, а не строки текста.
   */
  ratio?: string;
  /** Высота, когда ни вариант, ни пропорция не подходят: только из шкалы отступов. */
  height?: string;
  className?: string;
}

/**
 * Заглушка содержимого. Для скринридера её нет: занятость сообщает
 * контейнер через `aria-busy`, иначе читалка перечисляет пустые блоки.
 *
 * `ratio` и `height` уезжают в инлайн-стиль намеренно: высоту варианта
 * задаёт кит, и перебить её классом модуля можно было бы только удвоением
 * селектора — порядок модулей в бандле не гарантирован.
 */
export function Skeleton({ variant = "text", width, ratio, height, className }: SkeletonProps) {
  const style =
    width || ratio || height
      ? {
          width,
          aspectRatio: ratio,
          // При заданной пропорции высоту считает она сама
          height: ratio ? "auto" : height,
        }
      : undefined;

  return (
    <span
      aria-hidden="true"
      data-variant={variant}
      style={style}
      className={clsx(styles.skeleton, className)}
    />
  );
}
