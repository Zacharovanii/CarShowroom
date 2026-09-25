import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { ArrowRight, CalendarClock, Lock } from "lucide-react";
import { MAX_ACTIVE_TEST_DRIVES, SALON_TIME_ZONE, type CarDetails } from "@carshowroom/contracts";
import { Button, StatePanel, useToast } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { formatDate, formatDateTime } from "@/shared/format";
import { BookingDialog } from "./BookingDialog";
import { DayStrip } from "./DayStrip";
import { SlotGrid, SlotGridSkeleton } from "./SlotGrid";
import { useSlotSelection } from "./useSlotSelection";
import { useMyTestDrives, useSlots } from "./useTestDrives";
import styles from "./TestDriveSection.module.css";

/**
 * Лимит активных записей (TD-6). Считает и проверяет его сервер; здесь он
 * нужен только затем, чтобы не вести человека в модалку ради ошибки 422 —
 * так же, как это описано в разделе 4 макетов.
 */

export interface TestDriveSectionProps {
  car: CarDetails;
}

/**
 * Блок «Тест-драйв» на странице автомобиля — UC-G4 и вход в UC-U3,
 * раздел 4 docs/wireframes.md.
 *
 * Состояния слотов приходят готовыми (`free`, `bookable`): правило TD-5
 * фронт не пересчитывает. Вид блока зависит от роли, но сетка видна всем —
 * время смотрят до входа.
 */
export function TestDriveSection({ car }: TestDriveSectionProps) {
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const { days, date, time, selectDate, selectTime } = useSlotSelection();
  const slots = useSlots(car.slug, date);

  // Сотрудникам маршрут «Мои записи» недоступен (UC-M2), и запрос за ним
  // не уходит: он существует только для роли `user`.
  const isClient = user !== null && !isStaff;
  const mine = useMyTestDrives(isClient);
  const atLimit = (mine.data?.upcoming.length ?? 0) >= MAX_ACTIVE_TEST_DRIVES;

  /** Выбранным считается только слот, на который и правда можно записаться. */
  const selected =
    slots.data?.slots.find((slot) => slot.time === time && slot.free && slot.bookable) ?? null;

  /** Модалка — шаг после выбора слота, а не сам выбор, поэтому открывается кнопкой. */
  const [booking, setBooking] = useState(false);

  function openBooking() {
    if (user === null) {
      // Путь, день и время уже в адресе — `readReturnTo` достанет их оттуда
      navigate("/login", { state: { from: location } });
      return;
    }
    setBooking(true);
  }

  /** Слот устарел: закрываем модалку, снимаем выбор и перечитываем сетку. */
  function dropSelection() {
    setBooking(false);
    selectTime(null);
    void slots.refetch();
  }

  return (
    <section className={styles.section} aria-labelledby="test-drive-title">
      <header className={styles.head}>
        <h2 id="test-drive-title" className={styles.title}>
          Тест-драйв
        </h2>
        <p className={styles.zone}>Время московское · {SALON_TIME_ZONE}</p>
      </header>

      <DayStrip days={days} value={date} onChange={selectDate} />

      {slots.isError ? (
        <StatePanel
          variant="error"
          title="Не удалось загрузить свободное время"
          description="Проверьте соединение и попробуйте снова."
          action={
            <Button variant="primary" loading={slots.isFetching} onClick={() => slots.refetch()}>
              Повторить
            </Button>
          }
        />
      ) : slots.isPending ? (
        <SlotGridSkeleton />
      ) : (
        <SlotGrid
          slots={slots.data.slots}
          value={selected?.time ?? null}
          readOnly={isStaff}
          onSelect={(slot) => selectTime(slot.time)}
        />
      )}

      <p className={styles.legend}>
        Зачёркнуто — занято, бледное — слишком близко ко времени начала (машину не успеют
        подготовить), выделенное — ваш выбор.
      </p>

      {/* Пока слот не выбран, строка действия ведёт себя как обычный блок;
          с выбранным слотом на телефоне она прилипает к низу экрана
          (раздел 4 макетов), чтобы кнопка не уезжала за сетку. */}
      <div className={styles.action} data-sticky={selected !== null || undefined}>
        {isStaff ? (
          <p className={styles.staff}>
            <Lock aria-hidden="true" />
            Сотрудники не записываются на тест-драйв
          </p>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              disabled={selected === null || atLimit}
              iconStart={<CalendarClock aria-hidden="true" />}
              onClick={openBooking}
            >
              {selected ? `Записаться на ${formatDate(date)}, ${selected.time}` : "Выберите время"}
            </Button>

            {atLimit && (
              <p className={styles.limit}>
                У вас уже {MAX_ACTIVE_TEST_DRIVES} записи — больше держать нельзя.{" "}
                <Link to="/account/test-drives" className={styles.link}>
                  Мои записи
                  <ArrowRight aria-hidden="true" />
                </Link>
              </p>
            )}
          </>
        )}
      </div>

      <BookingDialog
        car={car}
        slot={booking && isClient && !atLimit ? selected : null}
        phone={user?.phone ?? ""}
        onClose={() => setBooking(false)}
        onRefreshSlots={() => void slots.refetch()}
        onSlotStale={dropSelection}
        onBooked={(startsAt) => {
          setBooking(false);
          selectTime(null);
          toast({
            tone: "success",
            description: `Записали на ${formatDateTime(startsAt)}`,
            action: { label: "Мои записи", onClick: () => navigate("/account/test-drives") },
          });
        }}
      />
    </section>
  );
}
