import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import styles from "./RootLayout.module.css";

/**
 * Каркас страницы (раздел 1 docs/wireframes.md). Полей у `main` нет
 * намеренно: hero главной идёт от края до края, а контейнер и отступы
 * задаёт сама страница — иначе full-bleed пришлось бы выламывать
 * отрицательными margin.
 */
export function RootLayout() {
  return (
    <div className={styles.shell}>
      <Header />

      <main className={styles.main}>
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
