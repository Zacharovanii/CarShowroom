import { useState } from "react";
import { Link } from "react-router-dom";
import { ImageOff } from "lucide-react";
import { createTestDriveSchema, type CarDetails, type Slot } from "@carshowroom/contracts";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import { fieldErrors, type FieldErrors } from "@/shared/form";
import { formatDateTime } from "@/shared/format";
import { bookingErrorView, type BookingErrorView } from "./bookingError";
import { useCreateTestDrive } from "./useTestDrives";
import styles from "./BookingDialog.module.css";

/** Предел комментария — из контракта, второй константы в проекте быть не должно. */
const COMMENT_MAX = createTestDriveSchema.shape.comment.unwrap().maxLength ?? 500;

export interface BookingDialogProps {
  car: CarDetails;
  /** Выбранный слот; `null` — модалка закрыта. */
  slot: Slot | null;
  /** Телефон профиля: подставляется в поле, человек может исправить. */
  phone: string;
  onClose: () => void;
  /** Сетка устарела: перезапросить её, не закрывая модалку. */
  onRefreshSlots: () => void;
  /** «Выбрать время»: закрыть модалку, снять выбор и перезапросить сетку. */
  onSlotStale: () => void;
  onBooked: (startsAt: string) => void;
}

export function BookingDialog({ car, slot, ...rest }: BookingDialogProps) {
  return (
    <Dialog open={slot !== null} onOpenChange={(open) => !open && rest.onClose()}>
      {/* key по слоту: у нового слота форма начинается с чистого листа,
          включая отметки TD-8 — согласие не переезжает с записи на запись */}
      {slot && <BookingForm key={slot.startsAt} car={car} slot={slot} {...rest} />}
    </Dialog>
  );
}

function BookingForm({
  car,
  slot,
  phone: profilePhone,
  onClose,
  onRefreshSlots,
  onSlotStale,
  onBooked,
}: BookingDialogProps & { slot: Slot }) {
  const create = useCreateTestDrive();

  const [phone, setPhone] = useState(profilePhone);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"phone" | "comment">>({});
  const [failure, setFailure] = useState<BookingErrorView | null>(null);

  /**
   * Отметки TD-8 живут только здесь: на провод они не уходят (D22) —
   * в `createTestDriveSchema` таких полей нет, а слать сверх контракта
   * нельзя. Пока не отмечены обе, «Подтвердить» выключена.
   */
  const [licence, setLicence] = useState(false);
  const [consent, setConsent] = useState(false);
  const agreed = licence && consent;

  const cover = car.images[0];

  function submit() {
    const parsed = createTestDriveSchema.safeParse({
      carId: car.id,
      startsAt: slot.startsAt,
      phone: phone.trim(),
      // Пустой комментарий не отправляется: схема требует непустую строку
      comment: comment.trim() === "" ? undefined : comment.trim(),
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setFailure(null);

    create.mutate(parsed.data, {
      onSuccess: () => onBooked(slot.startsAt),
      onError: (error) => {
        const view = bookingErrorView(error);
        setFailure(view);
        // Слот занят или ушёл за границу TD-5 — сетка под модалкой
        // перезапрашивается сразу, а не по кнопке в плашке
        if (view.action === "refresh") onRefreshSlots();
      },
    });
  }

  return (
    <DialogContent
      title="Запись на тест-драйв"
      bodyClassName={styles.body}
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" disabled={!agreed} loading={create.isPending} onClick={submit}>
            Подтвердить
          </Button>
        </div>
      }
    >
      <div className={styles.car}>
        {cover ? (
          <img className={styles.cover} src={cover.path} alt="" />
        ) : (
          <span className={styles.cover} aria-hidden="true">
            <ImageOff />
          </span>
        )}
        <div>
          <p className={styles.carName}>{car.name}</p>
          <p className={styles.when}>{formatDateTime(slot.startsAt)} (Мск)</p>
        </div>
      </div>

      {failure && (
        <Alert variant="error" title={failure.title}>
          {failure.message}{" "}
          {failure.action === "limit" && (
            <Link to="/account/test-drives" className={styles.link}>
              Мои записи
            </Link>
          )}
          {failure.action === "refresh" && (
            <button type="button" className={styles.link} onClick={onSlotStale}>
              Выбрать время
            </button>
          )}
        </Alert>
      )}

      <Field
        label="Телефон для связи"
        hint="Подставлен из профиля, можно исправить"
        error={errors.phone}
        required
      >
        {(control) => (
          <Input
            {...control}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            disabled={create.isPending}
            onChange={(event) => setPhone(event.target.value)}
          />
        )}
      </Field>

      <Field label="Комментарий (необязательно)" error={errors.comment}>
        {(control) => (
          <Textarea
            {...control}
            rows={3}
            showCount
            maxLength={COMMENT_MAX}
            value={comment}
            disabled={create.isPending}
            onChange={(event) => setComment(event.target.value)}
          />
        )}
      </Field>

      <div className={styles.terms}>
        <Checkbox checked={licence} onCheckedChange={setLicence} disabled={create.isPending}>
          У меня есть водительское удостоверение категории B и стаж от 2 лет
        </Checkbox>
        <Checkbox checked={consent} onCheckedChange={setConsent} disabled={create.isPending}>
          Согласен на обработку персональных данных
        </Checkbox>
        {/* Документы проверяют в салоне (TD-8) — человек должен знать об этом
            до того, как приедет */}
        <p className={styles.termsNote}>Документы проверит менеджер при встрече в салоне.</p>
      </div>
    </DialogContent>
  );
}
