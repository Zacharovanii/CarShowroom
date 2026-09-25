import type { ManagerTestDrive } from "@carshowroom/contracts";
import { ApiError } from "@/shared/api";

/** Запись ждёт отметки результата: слот прошёл, а статус всё ещё открытый. */
export const isAwaiting = (item: ManagerTestDrive): boolean =>
  item.started && item.status === "scheduled";

/**
 * Отказы при закрытии записи. Все они — про гонку: пока панель была открыта,
 * запись закрыл кто-то другой или слот успел начаться. Поэтому сообщение
 * не только называет причину, но и подсказывает, что список устарел.
 */
export function closeErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.";
  }

  if (error.is("ALREADY_CLOSED")) return "Запись уже закрыта — список устарел, обновите день.";
  if (error.is("SLOT_NOT_STARTED")) return "Слот ещё не начался — результата визита пока нет.";
  if (error.is("TOO_LATE_TO_CANCEL")) return "Слот уже начался — отменить запись нельзя.";
  if (error.is("NOT_FOUND")) return "Запись не найдена — возможно, её уже удалили.";
  if (error.is("FORBIDDEN")) return "Недостаточно прав для этого действия.";

  return "Не удалось сохранить. Попробуйте ещё раз.";
}
