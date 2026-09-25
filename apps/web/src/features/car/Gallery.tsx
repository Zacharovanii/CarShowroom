import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import type { CarImage } from "@carshowroom/contracts";
import { IconButton } from "@/components/ui";
import styles from "./Gallery.module.css";

export interface GalleryProps {
  images: CarImage[];
  /** Название автомобиля — подпись карусели и запасного вида без фото. */
  carName: string;
}

/** Доля ширины кадра, которую надо протащить, чтобы перелистнуть. */
const SWIPE_THRESHOLD = 0.15;
/** Сдвиг в px, после которого жест считается перетаскиванием, а не кликом. */
const DRAG_START = 8;

/**
 * Карусель фото: кадр на всю ширину, снимок вписан целиком — без обрезки
 * и растягивания, свободное место вокруг остаётся пустым фоном кадра.
 *
 * Листается стрелками, клавишами ←/→, миниатюрами и свайпом. Свайп не
 * прокручивает ленту свободно: кадр идёт за пальцем, а после отпускания
 * встаёт на соседний или возвращается. На краях — упор, без перескока
 * с последнего кадра на первый через всю ленту.
 */
export function Gallery({ images, carName }: GalleryProps) {
  const [active, setActive] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);

  const last = images.length - 1;

  // Активная миниатюра подкручивается в видимую часть ленты — горизонтально
  // и только внутри ленты, окно страницы не трогается.
  useEffect(() => {
    const strip = thumbs.current;
    const thumb = strip?.children[active];
    if (!strip || !(thumb instanceof HTMLElement)) return;

    const box = strip.getBoundingClientRect();
    const rect = thumb.getBoundingClientRect();
    if (rect.left < box.left) {
      strip.scrollBy({ left: rect.left - box.left, behavior: "smooth" });
    } else if (rect.right > box.right) {
      strip.scrollBy({ left: rect.right - box.right, behavior: "smooth" });
    }
  }, [active]);

  if (images.length === 0) {
    return (
      <div className={styles.gallery}>
        <div className={styles.empty} role="img" aria-label={`Фотографий ${carName} пока нет`}>
          <ImageOff aria-hidden="true" />
          <span>Фотографий пока нет</span>
        </div>
      </div>
    );
  }

  function go(index: number) {
    setActive(Math.min(Math.max(index, 0), last));
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(active + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(active - 1);
    }
  }

  function onThumbsKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown(event);
    const next = event.key === "ArrowRight" ? active + 1 : event.key === "ArrowLeft" ? active - 1 : null;
    if (next === null) return;
    const button = thumbs.current?.querySelectorAll("button")[Math.min(Math.max(next, 0), last)];
    button?.focus({ preventScroll: true });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (last === 0 || (event.pointerType === "mouse" && event.button !== 0)) return;
    gesture.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    if (!start) return;
    let dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (drag === null) {
      if (Math.abs(dx) < DRAG_START && Math.abs(dy) < DRAG_START) return;
      // Вертикальный жест — это прокрутка страницы, карусель его отпускает
      if (Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null;
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    // Упор на краях: кадр тянется, но втрое туже
    if ((active === 0 && dx > 0) || (active === last && dx < 0)) dx /= 3;
    setDrag(dx);
  }

  function onPointerUp() {
    const width = frame.current?.clientWidth ?? 0;
    const dx = drag ?? 0;
    gesture.current = null;
    setDrag(null);
    if (dx < -width * SWIPE_THRESHOLD) go(active + 1);
    else if (dx > width * SWIPE_THRESHOLD) go(active - 1);
  }

  function onPointerCancel() {
    gesture.current = null;
    setDrag(null);
  }

  const trackStyle = {
    "--index": active,
    "--drag": `${drag ?? 0}px`,
  } as CSSProperties;

  return (
    <div className={styles.gallery}>
      <div
        ref={frame}
        className={styles.frame}
        role="region"
        aria-roledescription="карусель"
        aria-label={`Фотографии ${carName}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div className={styles.track} style={trackStyle} data-dragging={drag !== null || undefined}>
          {images.map((image, index) => {
            // Грузится текущий кадр и соседи — остальные по мере листания
            const near = Math.abs(index - active) <= 1;
            return (
              <div
                key={image.path}
                className={styles.slide}
                role="group"
                aria-roledescription="слайд"
                aria-label={`${index + 1} из ${images.length}`}
                aria-hidden={index !== active}
              >
                <img
                  className={styles.photo}
                  src={image.path}
                  alt={image.alt}
                  draggable={false}
                  loading={near ? "eager" : "lazy"}
                  decoding="async"
                />
              </div>
            );
          })}
        </div>

        {last > 0 && (
          <>
            <IconButton
              variant="ghost"
              label="Предыдущее фото"
              icon={<ChevronLeft aria-hidden="true" />}
              className={styles.prev}
              disabled={active === 0}
              onClick={() => go(active - 1)}
            />
            <IconButton
              variant="ghost"
              label="Следующее фото"
              icon={<ChevronRight aria-hidden="true" />}
              className={styles.next}
              disabled={active === last}
              onClick={() => go(active + 1)}
            />
            <span className={styles.counter} aria-live="polite">
              {active + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {last > 0 && (
        <div
          ref={thumbs}
          className={styles.thumbs}
          role="group"
          aria-label="Миниатюры фотографий"
          onKeyDown={onThumbsKeyDown}
        >
          {images.map((image, index) => (
            <button
              key={image.path}
              type="button"
              className={styles.thumb}
              aria-pressed={index === active}
              aria-label={`Фото ${index + 1}`}
              onClick={() => go(index)}
            >
              <img src={image.path} alt="" loading="lazy" decoding="async" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
