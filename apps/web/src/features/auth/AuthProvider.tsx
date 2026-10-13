import { useMemo, useState, type ReactNode } from "react";
import { useSession } from "./authClient";
import { AuthContext, toUserRole, type AuthValue, type CurrentUser } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending: sessionPending } = useSession();

  // Better Auth поднимает isPending и при каждом перечитывании сессии гостя
  // (возврат на вкладку, вызовы signIn/signUp). Маршруты по isPending прячут
  // страницу — формы входа и регистрации размонтировались бы, теряя ввод
  // и экран «Проверьте почту». Поэтому «проверяется» — только первый раз.
  const [checked, setChecked] = useState(false);
  if (!sessionPending && !checked) setChecked(true);
  const isPending = !checked;

  const value = useMemo<AuthValue>(() => {
    const raw = data?.user;
    const user: CurrentUser | null = raw
      ? {
          id: raw.id,
          name: raw.name,
          email: raw.email,
          phone: typeof raw.phone === "string" ? raw.phone : "",
          role: toUserRole(raw.role),
          createdAt: new Date(raw.createdAt).toISOString(),
        }
      : null;

    const role = user?.role ?? null;

    return {
      user,
      isPending,
      isAuthenticated: user !== null,
      isStaff: role === "manager" || role === "admin",
      isAdmin: role === "admin",
    };
  }, [data, isPending]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
