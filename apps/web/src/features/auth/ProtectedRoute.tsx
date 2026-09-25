import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { UserRole } from "@carshowroom/contracts";
import { useAuth, homeRouteForRole } from "./authContext";

/** Пока сессия проверяется, показывать нечего — но и редиректить нельзя. */
function SessionPending() {
  return <div role="status" aria-busy="true" aria-label="Проверяем сессию" />;
}

/**
 * Требует входа. Куда человек шёл, запоминается в state — после входа
 * возвращаем туда же (UC-G4: выбранный слот не должен потеряться).
 */
export function ProtectedRoute() {
  const { isAuthenticated, isPending } = useAuth();
  const location = useLocation();

  if (isPending) return <SessionPending />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/**
 * Требует роли. Фронт только прячет недоступное — сам доступ проверяет
 * guard на каждом эндпоинте (use-cases.md, «Роли»).
 */
export function RoleRoute({ allow }: { allow: readonly UserRole[] }) {
  const { user, isPending } = useAuth();
  const location = useLocation();

  if (isPending) return <SessionPending />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={homeRouteForRole(user.role)} replace />;
  }

  return <Outlet />;
}

/** Вход и регистрация вошедшему не показываются (use-cases.md, «Страницы»). */
export function GuestOnlyRoute() {
  const { user, isPending } = useAuth();

  if (isPending) return <SessionPending />;

  if (user) {
    return <Navigate to={homeRouteForRole(user.role)} replace />;
  }

  return <Outlet />;
}
