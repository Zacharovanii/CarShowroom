import type { AdminCarStatus } from "@carshowroom/contracts";

/** Подписи фильтра статуса: значения — из контракта, здесь только русский текст. */
export const ADMIN_CAR_STATUS_LABELS: Record<AdminCarStatus, string> = {
  all: "Все",
  published: "Опубликованные",
  draft: "Черновики",
};
