import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { GuestOnlyRoute, ProtectedRoute, RoleRoute } from "@/features/auth";
import { RootLayout } from "@/components/layout/RootLayout";
import HomePage from "@/pages/HomePage";
import CatalogPage from "@/pages/CatalogPage";
import CarPage from "@/pages/CarPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ManagerPage from "@/pages/ManagerPage";
import NotFoundPage from "@/pages/NotFoundPage";
import AccountLayout from "@/pages/account/AccountLayout";
import ProfilePage from "@/pages/account/ProfilePage";
import TestDrivesPage from "@/pages/account/TestDrivesPage";
import UsersPage from "@/pages/admin/UsersPage";

/**
 * ВРЕМЕННО, этап 2: витрина UI-кита. Грузится лениво — она нужна только
 * разработчику и не должна лежать в основном бандле. Удаляется на этапе 11.
 */
const UiKitPage = lazy(() => import("@/pages/UiKitPage"));

/**
 * Карта маршрутов — раздел «Страницы» use-cases.md.
 * Декларативный режим (D3): Routes/Route, без loaders и actions —
 * данные везде идут через TanStack Query, чтобы механизм загрузки был один.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="catalog/:slug" element={<CarPage />} />

        {/* Вошедшему вход и регистрация не показываются */}
        <Route element={<GuestOnlyRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>

        {/* Кабинет клиента: вложенный маршрут через <Outlet /> */}
        <Route element={<ProtectedRoute />}>
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<ProfilePage />} />
            <Route path="test-drives" element={<TestDrivesPage />} />
          </Route>
        </Route>

        {/* Права накопительные: админ может всё, что менеджер */}
        <Route element={<RoleRoute allow={["manager", "admin"]} />}>
          <Route path="manager" element={<ManagerPage />} />
        </Route>

        <Route element={<RoleRoute allow={["admin"]} />}>
          <Route path="admin/users" element={<UsersPage />} />
        </Route>

        <Route
          path="__ui"
          element={
            <Suspense fallback={null}>
              <UiKitPage />
            </Suspense>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
