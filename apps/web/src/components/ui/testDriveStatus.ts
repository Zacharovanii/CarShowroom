import type { TestDriveStatus } from "@carshowroom/contracts";
import type { BadgeTone } from "./Badge";

/**
 * Статус записи → цвет и русская подпись. Таблица одна на весь проект:
 * в «Моих записях», в кабинете менеджера и в диалогах она не переписывается.
 * Пары цветов — §2 docs/design-system.md.
 *
 * Лежит отдельно от `StatusBadge`, потому что подписи нужны и без бейджа —
 * списку фильтра, тостам, обычному тексту, — а файл с компонентом не должен
 * экспортировать ничего, кроме компонента (правило react-refresh).
 */
export const TEST_DRIVE_STATUS_VIEW: Record<TestDriveStatus, { tone: BadgeTone; label: string }> = {
  scheduled: { tone: "info", label: "Запланирована" },
  completed: { tone: "success", label: "Состоялся" },
  no_show: { tone: "warning", label: "Не пришёл" },
  cancelled: { tone: "neutral", label: "Отменена" },
};

/** Только подписи: второй такой таблицы в проекте быть не должно. */
export const TEST_DRIVE_STATUS_LABELS: Record<TestDriveStatus, string> = {
  scheduled: TEST_DRIVE_STATUS_VIEW.scheduled.label,
  completed: TEST_DRIVE_STATUS_VIEW.completed.label,
  no_show: TEST_DRIVE_STATUS_VIEW.no_show.label,
  cancelled: TEST_DRIVE_STATUS_VIEW.cancelled.label,
};
