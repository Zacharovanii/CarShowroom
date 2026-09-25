import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { CalendarCheck, LogOut, User } from "lucide-react";
import clsx from "clsx";
import { signOut, useAuth } from "@/features/auth";
import styles from "./AccountLayout.module.css";

/**
 * Кабинет — раздел 7 макетов. Вложенный маршрут через <Outlet />:
 * разделы слева, содержимое справа, на телефоне разделы лентой сверху.
 */
export default function AccountLayout() {
  const { isStaff } = useAuth();
  const navigate = useNavigate();

  function itemClass({ isActive }: { isActive: boolean }) {
    return clsx(styles.item, isActive && styles.itemActive);
  }

  // UC-U1: сессию удаляет сервер, после выхода — на главную
  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Кабинет</h1>

      <div className={styles.body}>
        <nav className={styles.side} aria-label="Разделы кабинета">
          <NavLink to="/account" end className={itemClass}>
            <User aria-hidden="true" />
            Мои данные
          </NavLink>

          {/* Сотрудники на тест-драйвы не записываются (UC-M2) */}
          {!isStaff && (
            <NavLink to="/account/test-drives" className={itemClass}>
              <CalendarCheck aria-hidden="true" />
              Мои записи
            </NavLink>
          )}

          <button
            type="button"
            className={clsx(styles.item, styles.signOut)}
            onClick={handleSignOut}
          >
            <LogOut aria-hidden="true" />
            Выйти
          </button>
        </nav>

        <div>
          <Outlet />
        </div>
      </div>
    </section>
  );
}
