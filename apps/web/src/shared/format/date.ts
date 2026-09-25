import { SALON_TIME_ZONE } from "@carshowroom/contracts";

/**
 * Всё время показывается в поясе салона (TD-3) и подписывается явно.
 * Пояс браузера не используется нигде: клиент из Владивостока должен
 * видеть то же «14:00», что и менеджер в салоне.
 */

const date = new Intl.DateTimeFormat("ru-RU", {
  timeZone: SALON_TIME_ZONE,
  day: "numeric",
  month: "long",
});

const dateWithYear = new Intl.DateTimeFormat("ru-RU", {
  timeZone: SALON_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const time = new Intl.DateTimeFormat("ru-RU", {
  timeZone: SALON_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const weekdayShort = new Intl.DateTimeFormat("ru-RU", {
  timeZone: SALON_TIME_ZONE,
  weekday: "short",
});

const dayNumber = new Intl.DateTimeFormat("ru-RU", {
  timeZone: SALON_TIME_ZONE,
  day: "numeric",
});

/** «25 сентября» */
export const formatDate = (iso: string): string => date.format(new Date(iso));

/** «25 сентября 2026» — там, где год не очевиден из контекста */
export const formatDateWithYear = (iso: string): string => dateWithYear.format(new Date(iso));

/** «14:00» */
export const formatTime = (iso: string): string => time.format(new Date(iso));

/** «25 сентября, 14:00» */
export const formatDateTime = (iso: string): string => `${formatDate(iso)}, ${formatTime(iso)}`;

/** «пн» и «23» — подписи в ленте дней */
export const formatWeekday = (iso: string): string => weekdayShort.format(new Date(iso));
export const formatDayNumber = (iso: string): string => dayNumber.format(new Date(iso));

/**
 * Календарная дата пояса салона в формате контракта (`daySchema`, YYYY-MM-DD).
 * Через `en-CA` — это единственная локаль, чей короткий формат и есть ISO;
 * так дата берётся из нужного пояса, а не из пояса браузера.
 */
const isoDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: SALON_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const toSalonDay = (value: Date = new Date()): string => isoDay.format(value);

/** Сдвиг календарного дня на N суток, без ухода в пояс браузера. */
export function shiftDay(day: string, days: number): string {
  const [year, month, date_] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (date_ ?? 1) + days));
  return isoDay.format(shifted);
}
