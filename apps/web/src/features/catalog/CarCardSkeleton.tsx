import { Skeleton } from "@/components/ui";

/**
 * Заглушка карточки на время загрузки. Пропорция 3:4 задана вариантом
 * `card` в самом ките, поэтому сетка не прыгает при подстановке данных.
 */
export function CarCardSkeleton() {
  return <Skeleton variant="card" />;
}
