import { SALON_TIME_ZONE, type TestDriveStatus } from "@carshowroom/contracts";

/**
 * Правила тест-драйва TD-1…TD-9 (таблица в docs/use-cases.md). Живут здесь
 * константами и чистыми функциями, а не в схеме БД: продублировать их
 * триггерами — значит завести второе место, где они разойдутся
 * (docs/db/README.md, «Что держит БД, а что API»).
 *
 * Исключение — TD-4 («один слот автомобиля занимает одна запись») и «не больше
 * одной активной записи клиента на одно время» из TD-6: это гонка двух
 * одновременных запросов, её снимают только частичные уникальные индексы
 * в БД, никакая проверка в коде этого не умеет.
 */

/** TD-1: длительность слота, минут. */
export const SLOT_DURATION_MINUTES = 60;

/** TD-2: начало слотов — 10:00…18:00 по часу, 9 слотов в день, ежедневно. */
export const FIRST_SLOT_HOUR = 10;
export const LAST_SLOT_HOUR = 18;
export const SLOT_HOURS: readonly number[] = Array.from(
  { length: LAST_SLOT_HOUR - FIRST_SLOT_HOUR + 1 },
  (_, index) => FIRST_SLOT_HOUR + index,
);

/** TD-5: горизонт записи — от «через 2 часа» до 30 дней вперёд. */
export const BOOKING_MIN_LEAD_MINUTES = 120;
export const BOOKING_MAX_DAYS_AHEAD = 30;

/**
 * TD-6: не более 2 активных будущих записей у клиента.
 * Само число живёт в контракте — оно нужно и фронту, чтобы гасить кнопку
 * заранее. Здесь только реэкспорт, чтобы остальной код правил не знал,
 * откуда оно пришло.
 */
export { MAX_ACTIVE_TEST_DRIVES } from "@carshowroom/contracts";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Смещение пояса салона от UTC в минутах на заданный момент.
 *
 * Intl — единственный источник правды о поясе: захардкоженный «+03:00» был бы
 * верен для Москвы после 2014 года, но молча врал бы при любом другом поясе.
 * `longOffset` даёт строку вида «GMT+03:00» (или просто «GMT» для нуля).
 */
function zoneOffsetMinutes(instant: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: SALON_TIME_ZONE,
    timeZoneName: "longOffset",
  });
  const name = formatter.formatToParts(instant).find((part) => part.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Момент начала слота: календарный день пояса салона + час сетки → UTC.
 *
 * Сначала берём тот же час как UTC, узнаём смещение пояса на этот момент
 * и сдвигаемся на него. Одного шага достаточно: смещение меняется дважды
 * в год и максимум на час, а слоты стоят днём — попасть таким сдвигом
 * в другое смещение можно было бы только у слота около полуночи.
 */
export function slotInstant(date: string, hour: number): Date {
  const hh = String(hour).padStart(2, "0");
  const asUtc = new Date(`${date}T${hh}:00:00.000Z`);
  return new Date(asUtc.getTime() - zoneOffsetMinutes(asUtc) * MINUTE_MS);
}

/** Сетка дня (TD-2): 9 моментов начала слотов в хронологическом порядке. */
export function slotGrid(date: string): Date[] {
  return SLOT_HOURS.map((hour) => slotInstant(date, hour));
}

/** Подпись слота в поясе салона: «10:00». */
export function slotTimeLabel(instant: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: SALON_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}

/** Календарный день пояса салона для момента: «2026-09-23». */
export function salonDay(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SALON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** TD-2: попадает ли момент ровно в час сетки своего дня. */
export function isOnGrid(instant: Date): boolean {
  return slotGrid(salonDay(instant)).some((slot) => slot.getTime() === instant.getTime());
}

/** TD-5: окно записи на момент `now` — [не раньше, не позже]. */
export function bookingWindow(now: Date): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() + BOOKING_MIN_LEAD_MINUTES * MINUTE_MS),
    to: new Date(now.getTime() + BOOKING_MAX_DAYS_AHEAD * DAY_MS),
  };
}

/** TD-5: можно ли записаться на слот прямо сейчас. */
export function isWithinBookingWindow(instant: Date, now: Date): boolean {
  const { from, to } = bookingWindow(now);
  return instant.getTime() >= from.getTime() && instant.getTime() <= to.getTime();
}

/** TD-9: запись в конечном статусе больше не меняется. */
export function isClosed(status: TestDriveStatus): boolean {
  return status !== "scheduled";
}

/** TD-7: клиент отменяет свою запись, пока слот не начался. */
export function isCancellable(status: TestDriveStatus, startsAt: Date, now: Date): boolean {
  return !isClosed(status) && startsAt.getTime() > now.getTime();
}

/**
 * Границы календарных суток пояса салона: [начало дня, начало следующего).
 * Нужны списку записей дня у менеджера (UC-M1) — день там считается так же,
 * как сетка слотов, по поясу салона, а не по поясу сервера.
 */
export function salonDayRange(date: string): { from: Date; to: Date } {
  const from = slotInstant(date, 0);
  // следующий день берём по календарю пояса, а не «+24 часа»: в сутки
  // перевода стрелок их не 24. 36 часов заведомо попадают в следующий день.
  const to = slotInstant(salonDay(new Date(from.getTime() + 36 * 60 * MINUTE_MS)), 0);
  return { from, to };
}
