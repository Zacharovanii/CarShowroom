import type { BadgeTone } from "@/components/ui";
import type { UserRole } from "@carshowroom/contracts";

/** Роли по-русски: в интерфейсе `user` нигде не показывается (раздел 9 макетов). */
export const ROLE_LABELS: Record<UserRole, string> = {
  user: "Клиент",
  manager: "Менеджер",
  admin: "Админ",
};

/** Цвет бейджа роли: сотрудники выделяются, клиент остаётся нейтральным. */
export const ROLE_TONES: Record<UserRole, BadgeTone> = {
  user: "neutral",
  manager: "info",
  admin: "warning",
};
