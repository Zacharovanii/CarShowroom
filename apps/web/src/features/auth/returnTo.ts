import { slotSchema, slotsQuerySchema } from "@carshowroom/contracts";
import { formatDate } from "@/shared/format";

/**
 * Откуда человек пришёл на вход и что он там собирался сделать.
 * `ProtectedRoute` кладёт исходный Location в `location.state.from`.
 */
export type ReturnTo = {
  /** Путь с параметрами и якорем — `navigate` принимает его как есть. */
  to: string;
  /** Слот из `?date=&time=`: человек шёл записываться на тест-драйв (UC-G4). */
  slot: { date: string; time: string } | null;
};

/**
 * Слот читается из самого адреса, а не из отдельного поля state: на страницу
 * автомобиля приходят и по прямой ссылке с `?date=&time=`, и из сетки слотов.
 * Значения сверяются схемами контракта — чужой параметр в подпись не попадёт.
 */
function readSlot(search: string): ReturnTo["slot"] {
  const params = new URLSearchParams(search);
  const date = slotsQuerySchema.shape.date.safeParse(params.get("date") ?? "");
  const time = slotSchema.shape.time.safeParse(params.get("time") ?? "");

  if (!date.success || !time.success) return null;
  return { date: date.data, time: time.data };
}

/**
 * Разбирает `location.state`. Возвращается только свой путь: `//host` и
 * абсолютный адрес — это чужой сайт, туда после входа никого не отправляем.
 */
export function readReturnTo(state: unknown): ReturnTo | null {
  if (typeof state !== "object" || state === null) return null;

  const from = (state as { from?: unknown }).from;
  if (typeof from !== "object" || from === null) return null;

  const { pathname, search, hash } = from as {
    pathname?: unknown;
    search?: unknown;
    hash?: unknown;
  };
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.startsWith("//")) {
    return null;
  }

  const query = typeof search === "string" ? search : "";

  return {
    to: `${pathname}${query}${typeof hash === "string" ? hash : ""}`,
    slot: readSlot(query),
  };
}

/**
 * «25 сентября, 14:00» — подпись слота в пояснении над формой входа
 * и регистрации. Время уже подписано в поясе салона (TD-3), поэтому
 * форматируется только дата.
 */
export function formatSlot(slot: NonNullable<ReturnTo["slot"]>): string {
  return `${formatDate(slot.date)}, ${slot.time}`;
}
