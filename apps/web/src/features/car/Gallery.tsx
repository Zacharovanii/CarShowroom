import { useRef, useState, type KeyboardEvent } from "react";
import { ImageOff } from "lucide-react";
import type { CarImage } from "@carshowroom/contracts";
import styles from "./Gallery.module.css";

export interface GalleryProps {
  images: CarImage[];
  /** Название автомобиля — подпись запасного вида, когда фотографий нет. */
  carName: string;
}

/**
 * Крупный кадр и миниатюры под ним (раздел 4 wireframes.md).
 *
 * Миниатюра — обычная кнопка, поэтому клавиатура работает сама: Tab и
 * Enter/Space. Стрелки добавлены сверх этого, как в ленте: они переносят
 * и выбор, и фокус, чтобы не приходилось табать через весь ряд.
 */
export function Gallery({ images, carName }: GalleryProps) {
  const [active, setActive] = useState(0);
  const thumbs = useRef<HTMLDivElement>(null);

  // Сброс выбранного кадра при переходе на другой автомобиль делает не
  // эффект, а `key` на вызывающей стороне (CarMedia): состояние, которое
  // надо обнулять вместе с данными, дешевле пересоздать вместе с ними.
  const current = images[active];

  if (current === undefined) {
    // `images` в контракте — массив, и он бывает пустым: место кадра
    // всё равно занимает кадр, а не схлопнувшаяся пустота.
    return (
      <div className={styles.gallery}>
        <div className={styles.empty} role="img" aria-label={`Фотографий ${carName} пока нет`}>
          <ImageOff aria-hidden="true" />
          <span>Фотографий пока нет</span>
        </div>
      </div>
    );
  }

  function move(next: number) {
    const index = (next + images.length) % images.length;
    setActive(index);
    thumbs.current?.querySelectorAll("button")[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(active + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(active - 1);
    }
  }

  return (
    <div className={styles.gallery}>
      <div className={styles.frame}>
        <img
          className={styles.photo}
          src={current.path}
          alt={current.alt}
          // Крупный кадр виден сразу, миниатюры — тоже: их всего две
          decoding="async"
        />
      </div>

      {images.length > 1 && (
        <div
          ref={thumbs}
          className={styles.thumbs}
          role="group"
          aria-label="Фотографии автомобиля"
          onKeyDown={onKeyDown}
        >
          {images.map((image, index) => (
            <button
              key={image.path}
              type="button"
              className={styles.thumb}
              // Выбранная миниатюра помечена не только рамкой
              aria-pressed={index === active}
              onClick={() => setActive(index)}
            >
              <img src={image.path} alt={image.alt} loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
