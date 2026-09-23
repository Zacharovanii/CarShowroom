import {
  BOOKING_MAX_DAYS_AHEAD,
  BOOKING_MIN_LEAD_MINUTES,
  FIRST_SLOT_HOUR,
  LAST_SLOT_HOUR,
  MAX_ACTIVE_TEST_DRIVES,
  SLOT_DURATION_MINUTES,
  SLOT_HOURS,
  bookingWindow,
  isCancellable,
  isClosed,
  isOnGrid,
  isWithinBookingWindow,
  salonDay,
  slotGrid,
  slotInstant,
  slotTimeLabel,
} from "./rules.js";

// Правила TD-1…TD-9 — чистые функции без БД, поэтому проверяются целиком.

describe("Правила тест-драйва", () => {
  describe("TD-1, TD-2: сетка слотов", () => {
    it("9 слотов с 10:00 до 18:00 по часу", () => {
      expect(SLOT_DURATION_MINUTES).toBe(60);
      expect(SLOT_HOURS).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]);

      const grid = slotGrid("2026-09-23");
      expect(grid).toHaveLength(9);
      expect(grid.map(slotTimeLabel)).toEqual([
        "10:00",
        "11:00",
        "12:00",
        "13:00",
        "14:00",
        "15:00",
        "16:00",
        "17:00",
        "18:00",
      ]);

      for (let i = 1; i < grid.length; i += 1) {
        expect(grid[i]!.getTime() - grid[i - 1]!.getTime()).toBe(SLOT_DURATION_MINUTES * 60_000);
      }
    });

    it("TD-3: день считается по поясу салона, а не по UTC", () => {
      // Москва — UTC+3: 10:00 по салону это 07:00 UTC того же дня.
      expect(slotInstant("2026-09-23", FIRST_SLOT_HOUR).toISOString()).toBe(
        "2026-09-23T07:00:00.000Z",
      );
      expect(slotInstant("2026-09-23", LAST_SLOT_HOUR).toISOString()).toBe(
        "2026-09-23T15:00:00.000Z",
      );
      // зимой смещение то же — перехода на летнее время в Москве нет
      expect(slotInstant("2026-01-15", FIRST_SLOT_HOUR).toISOString()).toBe(
        "2026-01-15T07:00:00.000Z",
      );

      // момент 22:30 UTC — это уже следующий день в Москве
      expect(salonDay(new Date("2026-09-23T22:30:00Z"))).toBe("2026-09-24");
    });

    it("на сетке только ровные часы из окна работы", () => {
      expect(isOnGrid(new Date("2026-09-23T07:00:00Z"))).toBe(true); // 10:00 МСК
      expect(isOnGrid(new Date("2026-09-23T07:30:00Z"))).toBe(false); // 10:30 МСК
      expect(isOnGrid(new Date("2026-09-23T06:00:00Z"))).toBe(false); // 09:00 МСК
      expect(isOnGrid(new Date("2026-09-23T16:00:00Z"))).toBe(false); // 19:00 МСК
    });
  });

  describe("TD-5: окно записи", () => {
    const now = new Date("2026-09-23T09:00:00Z");

    it("от «через 2 часа» до 30 дней вперёд", () => {
      const { from, to } = bookingWindow(now);
      expect(from.toISOString()).toBe("2026-09-23T11:00:00.000Z");
      expect(BOOKING_MIN_LEAD_MINUTES).toBe(120);
      expect(to.getTime() - now.getTime()).toBe(BOOKING_MAX_DAYS_AHEAD * 24 * 3_600_000);
    });

    it("слишком близкий и слишком далёкий слоты недоступны", () => {
      expect(isWithinBookingWindow(new Date("2026-09-23T10:00:00Z"), now)).toBe(false);
      expect(isWithinBookingWindow(new Date("2026-09-23T11:00:00Z"), now)).toBe(true);
      expect(isWithinBookingWindow(new Date("2026-10-20T07:00:00Z"), now)).toBe(true);
      expect(isWithinBookingWindow(new Date("2026-10-25T07:00:00Z"), now)).toBe(false);
    });
  });

  describe("TD-6: лимит клиента", () => {
    it("не больше двух активных записей", () => {
      expect(MAX_ACTIVE_TEST_DRIVES).toBe(2);
    });
  });

  describe("TD-7, TD-9: статусы и отмена", () => {
    const now = new Date("2026-09-23T09:00:00Z");
    const future = new Date("2026-09-24T07:00:00Z");
    const past = new Date("2026-09-22T07:00:00Z");

    it("закрытой считается любая запись не в scheduled", () => {
      expect(isClosed("scheduled")).toBe(false);
      expect(isClosed("completed")).toBe(true);
      expect(isClosed("no_show")).toBe(true);
      expect(isClosed("cancelled")).toBe(true);
    });

    it("отменить можно только открытую запись до начала слота", () => {
      expect(isCancellable("scheduled", future, now)).toBe(true);
      expect(isCancellable("scheduled", past, now)).toBe(false);
      expect(isCancellable("scheduled", now, now)).toBe(false);
      expect(isCancellable("cancelled", future, now)).toBe(false);
      expect(isCancellable("completed", future, now)).toBe(false);
    });
  });
});
