import { useCallback, useSyncExternalStore } from "react";

/**
 * Ширина экрана как значение, а не как `@media`. Нужна там, где по брейкпоинту
 * меняется сама разметка, а не оформление: каталог держит фильтры то боковой
 * панелью, то листом снизу, список пользователей — то таблицей, то карточками.
 * Двух копий разметки в DOM быть не должно (в них жили бы два черновика
 * поиска), поэтому раскладка выбирается в коде, а не через `display: none`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // SSR в проекте нет, но у useSyncExternalStore снимок для сервера обязателен
    () => false,
  );
}
