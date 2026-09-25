import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth";
import { ApiError } from "@/shared/api";
import { ToastProvider } from "@/components/ui/Toast";
import { AppRoutes } from "./AppRoutes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Каталог меняется только сидом, слоты — редко. Минута свежести
      // убирает мигание при возврате назад и не даёт показывать протухшее.
      staleTime: 60_000,
      retry: (failureCount, error) => {
        // Повторять 404 и 403 бессмысленно: ответ не изменится
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Уведомления — над роутером: их показывает любая страница одной строкой */}
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
