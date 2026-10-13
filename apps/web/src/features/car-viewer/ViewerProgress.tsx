import styles from "./CarViewer.module.css";

export interface ViewerProgressProps {
  /** Проценты загрузки. `null` — пока качается код сцены, и процентов ещё нет. */
  progress: number | null;
  /** Фотография-подложка: место кадра не пустует, пока грузится модель. */
  backdrop: { path: string; alt: string } | null;
}

/**
 * Полоса прогресса поверх фотографии.
 *
 * Один и тот же вид на два этапа: сначала качается ленивый чанк со сценой
 * (процентов нет — полоса бежит сама), потом GLB (`useProgress` из drei даёт
 * проценты). Подложка — фотография автомобиля, поэтому кадр не схлопывается
 * и не мигает пустотой.
 */
export function ViewerProgress({ progress, backdrop }: ViewerProgressProps) {
  const percent = progress === null ? null : Math.round(progress);

  return (
    <div className={styles.loading}>
      {backdrop !== null && (
        <img className={styles.backdrop} src={backdrop.path} alt={backdrop.alt} />
      )}

      <div className={styles.loadingBody}>
        <div
          className={styles.bar}
          role="progressbar"
          aria-label="Загрузка 3D-модели"
          aria-valuemin={0}
          aria-valuemax={100}
          // Пока процентов нет, значение не объявляется: полоса неопределённая,
          // и скринридер не должен слышать выдуманный ноль
          aria-valuenow={percent ?? undefined}
        >
          <span
            className={styles.barFill}
            data-indeterminate={percent === null || undefined}
            style={percent === null ? undefined : { inlineSize: `${percent}%` }}
          />
        </div>
        <p className={styles.loadingText}>
          Загружается 3D-модель{percent === null ? "" : ` · ${percent}%`}
        </p>
      </div>
    </div>
  );
}
