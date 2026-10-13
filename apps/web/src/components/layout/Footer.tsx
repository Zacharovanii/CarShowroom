import { Link } from "react-router-dom";
import { Clock, MapPin, Phone } from "lucide-react";
import styles from "./Footer.module.css";

/**
 * Подвал — §8 docs/design-system.md. Пометка «учебный проект» обязательна
 * и стоит отдельной строкой: это требование D1, а не вежливость.
 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.columns}>
          <div className={styles.brandColumn}>
            <span className={styles.brand}>CarShowroom</span>
            <p className={styles.tagline}>Дилерский центр</p>
          </div>

          <nav className={styles.column} aria-label="Разделы в подвале">
            <span className={styles.columnTitle}>Автомобили</span>
            <Link to="/catalog" className={styles.link}>
              Каталог
            </Link>
            <Link to="/catalog" className={styles.link}>
              Тест-драйв
            </Link>
            <Link to="/" className={styles.link}>
              О салоне
            </Link>
          </nav>

          <address className={styles.column}>
            <span className={styles.columnTitle}>Контакты</span>
            <span className={styles.contact}>
              <MapPin aria-hidden="true" />
              г. Москва, ул. Примерная, 1
            </span>
            <a href="tel:+70000000000" className={styles.link}>
              <Phone aria-hidden="true" />
              +7 000 000-00-00
            </a>
            <span className={styles.contact}>
              <Clock aria-hidden="true" />
              Ежедневно 10:00–20:00
            </span>
          </address>
        </div>

        <p className={styles.note}>Учебный проект. Не является официальным сайтом BMW.</p>
      </div>
    </footer>
  );
}
