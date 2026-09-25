import { ApiError } from "@/shared/api";

/**
 * Что делать с отказом на записи (UC-U3):
 * - `refresh` — слот устарел, сетку надо перезапросить и снять выбор;
 * - `limit` — упёрлись в TD-6, дорога отсюда одна: в «Мои записи»;
 * - `retry` — всё остальное, можно просто повторить.
 */
export type BookingErrorAction = "refresh" | "limit" | "retry";

export interface BookingErrorView {
  action: BookingErrorAction;
  title: string;
  message: string;
}

/**
 * Три отказа сервера разведены по-разному намеренно: у каждого свой текст
 * и своё продолжение. Сообщения свои, а не из `error.message` — серверные
 * формулировки короче, чем нужно человеку в модалке.
 */
export function bookingErrorView(error: unknown): BookingErrorView {
  if (error instanceof ApiError) {
    if (error.is("SLOT_TAKEN")) {
      return {
        action: "refresh",
        title: "Это время уже заняли",
        message: "Выберите другое — сетка обновлена.",
      };
    }

    if (error.is("TOO_MANY_ACTIVE")) {
      return {
        action: "limit",
        title: "У вас уже 2 активные записи",
        message: "Отмените одну — и сможете записаться.",
      };
    }

    if (error.is("SLOT_OUT_OF_RANGE")) {
      return {
        action: "refresh",
        title: "До этого времени осталось меньше двух часов",
        message: "Машину не успеют подготовить. Выберите время позже — сетка обновлена.",
      };
    }

    if (error.is("NOT_FOUND")) {
      return {
        action: "retry",
        title: "Автомобиль не найден",
        message: "Возможно, его сняли с публикации. Обновите страницу.",
      };
    }
  }

  return {
    action: "retry",
    title: "Не удалось записаться",
    message: "Проверьте соединение и попробуйте ещё раз.",
  };
}

/** Отказы при отмене записи (UC-U4). Все они про то, что список устарел. */
export function cancelErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.is("ALREADY_CLOSED")) return "Запись уже закрыта — обновите список.";
    if (error.is("TOO_LATE_TO_CANCEL")) return "Слот уже начался — отменить запись нельзя.";
    if (error.is("NOT_FOUND")) return "Запись не найдена — возможно, её уже отменили.";
  }

  return "Не удалось отменить. Проверьте соединение и попробуйте ещё раз.";
}
