import type { CSSProperties } from "react";
import { ArrowRight, CreditCard, Repeat, ShieldCheck, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero.jpg";
import testDrivePhoto from "@/assets/test-drive.jpg";
import { CarCard, CarCardSkeleton, useCars } from "@/features/catalog";
import { LinkButton } from "@/shared/ui/LinkButton";
import styles from "./HomePage.module.css";

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
 * Главная — UC-G1.
 *
 * Оба призыва ведут в каталог: записаться можно только на конкретный
 * автомобиль (UC-G4), отдельного экрана записи в сервисе нет.
 */
export default function HomePage() {
  const { data, isPending, isError } = useCars({ sort: "newest" });
  const cars = data?.items.slice(0, 4) ?? [];

  return (
    <div className={styles.page}>
      <section className={styles.hero} data-hero-section>
        <img className={styles.heroPhoto} src={heroImage} alt="BMW M4 CSL на гоночном треке" />

        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>Автомобили, которые ведут</h1>
            <p className={styles.heroLede}>
              Все модели в наличии. Тест-драйв — за минуту, без звонков и ожидания.
            </p>
            <div className={styles.heroActions}>
              <LinkButton to="/catalog" variant="primary" size="lg">
                Выбрать автомобиль
              </LinkButton>
              <LinkButton to="/catalog" variant="ghost" size="lg" className={styles.heroGhostButton}>
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
          <h2 className={styles.whyTitle}>Почему мы</h2>

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

      <section className={styles.testDriveSection}>
        {/* Родитель — сама картинка (background-image, не <img>): два
            flex-1 в нём делят ширину поровну. Левый пустой — там читается
            фото. Правый центрирует блок текста внутри своей половины —
            так текст физически не может залезть на фото, а не просто
            визуально не перекрывает его. */}
        <div
          className={styles.testDrive}
          style={{ "--test-drive-photo": `url(${testDrivePhoto})` } as CSSProperties}
        >
          <div className={styles.testDriveSpacer} aria-hidden="true" />

          <div className={styles.testDriveTextCol}>
            <div className={styles.testDriveText}>
              <p className={styles.eyebrow}>Тест-драйв</p>
              <h2 className={styles.sectionTitle}>Выберите день и время</h2>
              <p className={styles.sectionLede}>
                Остальное сделаем мы: подготовим автомобиль и встретим вас в салоне. Запись
                занимает минуту и начинается с выбора машины.
              </p>
              <LinkButton to="/catalog" variant="primary">
                Выбрать автомобиль
              </LinkButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
