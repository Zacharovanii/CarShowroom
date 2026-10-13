import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, CircleSlash } from "lucide-react";
import { Button, PriceTag, StatePanel } from "@/components/ui";
import { LinkButton } from "@/shared/ui/LinkButton";
import { CarMedia, CarPageSkeleton, CarSpecs, isCarNotFound, useCar } from "@/features/car";
import { TestDriveSection } from "@/features/test-drives";
import styles from "./CarPage.module.css";

/**
 * Страница автомобиля — UC-G3.
 *
 * Блок тест-драйва (UC-G4, UC-U3) собирает `features/test-drives`; сюда он
 * приходит одним компонентом. Фото и 3D переключаются вкладками —
 * см. `features/car/CarMedia.tsx`.
 */
export default function CarPage() {
  // slug из адреса — единственный источник: страница открывается по ссылке
  const { slug } = useParams<{ slug: string }>();
  const car = useCar(slug);
  const testDrive = useRef<HTMLDivElement>(null);

  // Переход из каталога — это SPA-навигация, а не загрузка страницы: без
  // сброса скролл остаётся там, где был на каталоге, и машина открывается
  // не с начала.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (car.isError) {
    return (
      <div className={styles.page}>
        {isCarNotFound(car.error) ? (
          <StatePanel
            icon={<CircleSlash aria-hidden="true" />}
            title="Автомобиль не найден"
            description="Возможно, он снят с публикации или ссылка устарела."
            action={<LinkButton to="/catalog">В каталог</LinkButton>}
          />
        ) : (
          <StatePanel
            variant="error"
            title="Не удалось загрузить автомобиль"
            description="Проверьте соединение и попробуйте снова."
            action={
              <Button variant="primary" loading={car.isFetching} onClick={() => car.refetch()}>
                Повторить
              </Button>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {car.isPending ? (
        <CarPageSkeleton />
      ) : (
        <>
          <div className={styles.top}>
            <CarMedia
              car={car.data}
              leading={
                <LinkButton
                  to="/catalog"
                  variant="ghost"
                  size="sm"
                  iconStart={<ArrowLeft aria-hidden="true" />}
                >
                  В каталог
                </LinkButton>
              }
            />

            <div className={styles.head}>
              <h1 className={styles.name}>{car.data.name}</h1>
              <p className={styles.kind}>
                {car.data.bodyTypeName} · {car.data.modelYear}
              </p>

              <PriceTag value={car.data.price} size="lg" className={styles.price} />

              <Button
                variant="primary"
                size="lg"
                iconStart={<CalendarClock aria-hidden="true" />}
                className={styles.book}
                onClick={() => testDrive.current?.scrollIntoView({ behavior: "smooth" })}
              >
                Записаться на тест-драйв
              </Button>

              <p className={styles.description}>{car.data.description}</p>
            </div>
          </div>

          <section className={styles.section} aria-labelledby="specs-title">
            <h2 id="specs-title" className={styles.sectionTitle}>
              Характеристики
            </h2>
            <CarSpecs car={car.data} />
          </section>

          {/* На якорь ведёт кнопка «Записаться на тест-драйв» из шапки карточки */}
          <div ref={testDrive} id="test-drive" className={styles.testDrive}>
            <TestDriveSection car={car.data} />
          </div>
        </>
      )}
    </div>
  );
}
