import { ArrowRight, CreditCard, Repeat, ShieldCheck, Wrench } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CarCard, CarCardSkeleton, useCars } from "@/features/catalog";
import { LinkButton } from "@/shared/ui/LinkButton";
import styles from "./HomePage.module.css";

/** Сколько держится один кадр карусели в hero. */
const HERO_INTERVAL_MS = 6000;

const TEST_DRIVE_PHOTO = "/assets/cars/m4-cabrio-1.webp";

const STATS = [
  { value: "10+", label: "лет на рынке" },
  { value: "5 000+", label: "клиентов" },
  { value: "15", label: "городов" },
  { value: "30+", label: "моделей" },
];

const ADVANTAGES = [
  {
    icon: ShieldCheck,
    title: "Гарантия",
    text: "До 4 лет или 80 000 км пробега — что наступит раньше.",
  },
  {
    icon: CreditCard,
    title: "Кредит",
    text: "Программы банков-партнёров, решение в день обращения.",
  },
  {
    icon: Repeat,
    title: "Trade-in",
    text: "Оценим вашу машину и зачтём её в стоимость новой.",
  },
  {
    icon: Wrench,
    title: "Сервис",
    text: "Плановое ТО и ремонт у мастеров, обученных на марке.",
  },
];

/**
 * Главная — UC-G1, раздел 2 docs/wireframes.md.
 *
 * Оба призыва ведут в каталог: записаться можно только на конкретный
 * автомобиль (UC-G4), отдельного экрана записи в сервисе нет.
 */
export default function HomePage() {
  const { data, isPending, isError } = useCars({ sort: "newest" });
  const cars = data?.items.slice(0, 4) ?? [];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <HeroCarousel photos={data?.items ?? []} />

        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>Автомобили, которые ведут</h1>
            <p className={styles.heroLede}>
              Десять моделей в наличии. Тест-драйв — за минуту, без звонков и ожидания.
            </p>
            <div className={styles.heroActions}>
              <LinkButton to="/catalog" variant="primary" size="lg">
                Выбрать автомобиль
              </LinkButton>
              <LinkButton to="/catalog" variant="ghost" size="lg">
                Записаться на тест-драйв
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* Витрина при ошибке скрывается целиком: главная остаётся визиткой
          и без неё, «Повторить» здесь никому не нужно. */}
      {!isError && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>Модельный ряд</p>
              <p className={styles.sectionLede}>
                {data ? `Четыре автомобиля из ${data.total}` : "Свежие поступления салона"}
              </p>
            </div>
            <Link to="/catalog" className={styles.moreLink}>
              Весь каталог
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>

          <div className={styles.cars} aria-busy={isPending || undefined}>
            {isPending
              ? [0, 1, 2, 3].map((index) => <CarCardSkeleton key={index} />)
              : cars.map((car, index) => <CarCard key={car.id} car={car} priority={index < 2} />)}
          </div>
        </section>
      )}

      <section className={styles.sectionAlt}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Почему мы</p>

          <div className={styles.stats}>
            {STATS.map((stat) => (
              <div key={stat.label} className={styles.stat}>
                <span className={styles.statValue}>{stat.value}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>

          <div className={styles.advantages}>
            {ADVANTAGES.map(({ icon: Icon, title, text }) => (
              <div key={title} className={styles.advantage}>
                <Icon aria-hidden="true" />
                <h3 className={styles.advantageTitle}>{title}</h3>
                <p className={styles.advantageText}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.testDrive}>
          <img
            className={styles.testDrivePhoto}
            src={TEST_DRIVE_PHOTO}
            alt="BMW X5 в шоуруме дилерского центра"
            loading="lazy"
          />
          <div className={styles.testDriveText}>
            <p className={styles.eyebrow}>Тест-драйв</p>
            <h2 className={styles.sectionTitle}>Выберите день и время</h2>
            <p className={styles.sectionLede}>
              Остальное сделаем мы: подготовим автомобиль и встретим вас в салоне. Запись занимает
              минуту и начинается с выбора машины.
            </p>
            <LinkButton to="/catalog" variant="primary">
              Выбрать автомобиль
            </LinkButton>
          </div>
        </div>
      </section>
    </div>
  );
}

interface HeroPhoto {
  coverPath: string | null;
  coverAlt: string | null;
}

/**
 * Фон hero: обложки автомобилей в случайном порядке, смена наплывом.
 * Порядок перемешивается один раз на загрузку данных, а не на каждый рендер.
 * При prefers-reduced-motion кадр не меняется — остаётся первый.
 */
function HeroCarousel({ photos }: { photos: HeroPhoto[] }) {
  const shuffled = useMemo(
    () => shuffle(photos.filter((photo) => photo.coverPath !== null)),
    [photos],
  );
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (shuffled.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % shuffled.length);
    }, HERO_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [shuffled]);

  return shuffled.map((photo, index) => {
    const isActive = index === active % shuffled.length;
    return (
      <Fragment key={photo.coverPath}>
        <img
          className={`${styles.heroPhoto} ${styles.heroBackdrop}`}
          data-active={isActive}
          src={photo.coverPath!}
          alt=""
          aria-hidden="true"
        />
        <img
          className={styles.heroPhoto}
          data-active={isActive}
          src={photo.coverPath!}
          alt={isActive ? (photo.coverAlt ?? "") : ""}
          aria-hidden={!isActive}
          fetchPriority={index === 0 ? "high" : "low"}
        />
      </Fragment>
    );
  });
}

/** Перемешивание Фишера — Йетса, возвращает новый массив. */
function shuffle<T>(items: T[]): T[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}
