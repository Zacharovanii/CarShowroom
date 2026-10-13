import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { signOut, useAuth } from "@/features/auth";
import { LinkButton } from "@/shared/ui/LinkButton";
import styles from "./Header.module.css";

type NavItem = { to: string; label: string; end?: boolean };

/**
 * Шапка — §8 docs/design-system.md. Состав меню зависит от роли, но
 * ничего не решает: права проверяет бэкенд, шапка лишь не показывает
 * то, куда всё равно не пустят.
 */
export function Header() {
  const { user, isStaff, isAdmin, isPending } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Hero на главной — фото во весь экран от самого верха страницы;
  // шапка над ним плавает почти без подложки, как в референсе дизайна.
  const isHero = location.pathname === "/";

  // Тёмная подложка нужна не от факта скролла, а от того, вышла ли сама
  // шапка за пределы hero-секции: пока низ hero ниже низа шапки, под шапкой
  // всё ещё фото и подложка не нужна. Как только hero прокрутили выше —
  // там уже обычный контент секций, накладывающийся на прозрачную шапку.
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isHero) return;
    const heroEl = document.querySelector<HTMLElement>("[data-hero-section]");
    if (!heroEl) return;

    function onScroll() {
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      setScrolled(heroEl!.getBoundingClientRect().bottom <= headerHeight);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [isHero]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountPanelId = useId();
  const accountRef = useRef<HTMLDivElement>(null);

  // Переход на другую страницу закрывает и мобильное меню, и выпадающее.
  // Это правка состояния прямо в рендере, а не эффект: React пересчитает
  // компонент до отрисовки, и меню не успеет мигнуть поверх новой страницы.
  const [shownPath, setShownPath] = useState(location.pathname);
  if (shownPath !== location.pathname) {
    setShownPath(location.pathname);
    setMenuOpen(false);
    setAccountOpen(false);
  }

  // Меню на весь экран: страница под ним прокручиваться не должна
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  // Выпадающее меню закрывается по Esc и по клику мимо него
  useEffect(() => {
    if (!accountOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [accountOpen]);

  const navItems: NavItem[] = [
    { to: "/", label: "Главная", end: true },
    { to: "/catalog", label: "Каталог" },
    ...(isStaff ? [{ to: "/manager", label: "Записи" }] : []),
    // Без `end`: карточка `/admin/cars/5` подсвечивает свой раздел
    ...(isAdmin
      ? [
          { to: "/admin/users", label: "Пользователи" },
          { to: "/admin/cars", label: "Автомобили" },
        ]
      : []),
  ];

  async function handleSignOut() {
    setAccountOpen(false);
    setMenuOpen(false);
    await signOut();
    navigate("/");
  }

  function navClass({ isActive }: { isActive: boolean }) {
    return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
  }

  function menuClass({ isActive }: { isActive: boolean }) {
    return isActive ? `${styles.menuLink} ${styles.menuLinkActive}` : styles.menuLink;
  }

  return (
    <header
      ref={headerRef}
      className={
        isHero
          ? `${styles.header} ${scrolled ? styles.headerScrolled : styles.headerHero}`
          : styles.header
      }
    >
      <div className={styles.inner}>
        <Link to="/" className={styles.brand}>
          CarShowroom
        </Link>

        <nav className={styles.nav} aria-label="Разделы сайта">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.account}>
          {isPending ? (
            // Пока сессия проверяется, гостевой вид показывать нельзя: он
            // мигнёт и сменится именем. Вместо него — нейтральная заглушка.
            <span className={styles.accountPending} aria-hidden="true" />
          ) : user ? (
            <div className={styles.accountMenu} ref={accountRef}>
              <button
                type="button"
                className={styles.accountButton}
                aria-expanded={accountOpen}
                aria-controls={accountPanelId}
                onClick={() => setAccountOpen((open) => !open)}
              >
                {user.name}
                <ChevronDown aria-hidden="true" />
              </button>

              {accountOpen && (
                // Это раскрывающийся блок ссылок, а не ARIA-меню. Роли
                // menu/menuitem здесь были бы обещанием, которого мы не держим:
                // по шаблону меню пункты выключены из Tab и листаются стрелками.
                // Наши пункты — обычные ссылки, значит и объявляются обычными:
                // Tab ходит по ним сам, Esc закрывает.
                <nav className={styles.dropdown} id={accountPanelId} aria-label="Аккаунт">
                  <Link to="/account" className={styles.dropdownItem}>
                    Мои данные
                  </Link>
                  {/* Сотрудники на тест-драйвы не записываются (UC-M2) */}
                  {!isStaff && (
                    <Link to="/account/test-drives" className={styles.dropdownItem}>
                      Мои записи
                    </Link>
                  )}
                  <button type="button" className={styles.dropdownItem} onClick={handleSignOut}>
                    Выйти
                  </button>
                </nav>
              )}
            </div>
          ) : isHero ? (
            // Над hero — как кнопки самого hero-блока: одна залита белым,
            // вторая с белой рамкой на прозрачном. Обычные navLink/secondary
            // (серый текст, серая рамка) на фото не читаются.
            <>
              <LinkButton to="/login" variant="ghost" className={styles.headerHeroButton}>
                Войти
              </LinkButton>
              <LinkButton to="/register" variant="primary">
                Регистрация
              </LinkButton>
            </>
          ) : (
            <>
              <Link to="/login" className={styles.navLink}>
                Войти
              </Link>
              <LinkButton to="/register" variant="secondary">
                Регистрация
              </LinkButton>
            </>
          )}
        </div>

        <button
          type="button"
          className={styles.burger}
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          <nav className={styles.mobileNav} aria-label="Разделы сайта">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={menuClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className={styles.mobileAccount}>
            {isPending ? (
              <span className={styles.accountPending} aria-hidden="true" />
            ) : user ? (
              <>
                <span className={styles.mobileName}>{user.name}</span>
                <Link to="/account" className={styles.menuLink}>
                  Мои данные
                </Link>
                {!isStaff && (
                  <Link to="/account/test-drives" className={styles.menuLink}>
                    Мои записи
                  </Link>
                )}
                <button type="button" className={styles.menuLink} onClick={handleSignOut}>
                  <LogOut aria-hidden="true" />
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={styles.menuLink}>
                  Войти
                </Link>
                <LinkButton to="/register" variant="primary" className={styles.mobileCta}>
                  Регистрация
                </LinkButton>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
