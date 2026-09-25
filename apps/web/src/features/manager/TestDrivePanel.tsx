import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleCheck, Lock, TriangleAlert, UserX } from "lucide-react";
import {
  closeTestDriveSchema,
  type CloseTestDrive,
  type ManagerTestDrive,
} from "@carshowroom/contracts";
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  Field,
  StatusBadge,
  TEST_DRIVE_STATUS_LABELS,
  Textarea,
  useToast,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/shared/format";
import { closeErrorMessage, isAwaiting } from "./status";
import { useCloseTestDrive } from "./useManagerDay";
import styles from "./TestDrivePanel.module.css";

export interface TestDrivePanelProps {
  /** Открытая запись; `null` — панель закрыта. */
  item: ManagerTestDrive | null;
  onClose: () => void;
}

/**
 * Панель записи (UC-M2). Это диалог из кита, а не отдельная страница: менеджер
 * не должен терять список. На десктопе она прижата к правому краю, на телефоне
 * раскрывается снизу на весь экран — ловушка фокуса, Esc и возврат фокуса
 * достаются от Radix вместе с `Dialog`.
 *
 * Набор действий выводится из `started` и `status`, которые считает сервер:
 * правило TD-9 на фронте не повторяется.
 */
export function TestDrivePanel({ item, onClose }: TestDrivePanelProps) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      {item && <PanelBody key={item.id} item={item} onClose={onClose} />}
    </Dialog>
  );
}

function PanelBody({ item, onClose }: { item: ManagerTestDrive; onClose: () => void }) {
  const toast = useToast();
  const close = useCloseTestDrive();

  /** Форма отмены разворачивается на месте кнопок — вторым модальным окном
      поверх панели она на телефоне закрыла бы сама себя. */
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);

  const closed = item.status !== "scheduled";

  function run(body: CloseTestDrive, success: string) {
    setAlert(null);
    close.mutate(
      { id: item.id, body },
      {
        onSuccess: () => {
          toast({ tone: "success", description: success });
          onClose();
        },
        onError: (error) => setAlert(closeErrorMessage(error)),
      },
    );
  }

  function submitCancel() {
    const parsed = closeTestDriveSchema.safeParse({ status: "cancelled", cancelReason: reason });
    if (!parsed.success) {
      setReasonError("Укажите причину — её увидит клиент");
      return;
    }

    setReasonError(null);
    run(parsed.data, "Запись отменена, клиент увидит причину");
  }

  return (
    <DialogContent
      title={`${item.time} · ${formatDate(item.startsAt)}`}
      placement="side"
      footer={
        <div className={styles.actions}>
          {alert && <Alert variant="error">{alert}</Alert>}

          {closed ? (
            <p className={styles.closed}>
              <Lock aria-hidden="true" />
              Запись закрыта: {TEST_DRIVE_STATUS_LABELS[item.status].toLowerCase()}. Изменить её
              нельзя.
            </p>
          ) : item.started ? (
            <div className={styles.buttons}>
              <Button
                variant="primary"
                loading={close.isPending}
                iconStart={<CircleCheck aria-hidden="true" />}
                onClick={() => run({ status: "completed" }, "Отмечено: тест-драйв состоялся")}
              >
                Состоялся
              </Button>
              <Button
                loading={close.isPending}
                iconStart={<UserX aria-hidden="true" />}
                onClick={() => run({ status: "no_show" }, "Отмечено: клиент не пришёл")}
              >
                Не пришёл
              </Button>
            </div>
          ) : cancelling ? (
            <div className={styles.cancelForm}>
              <Field
                label="Причина отмены"
                hint="Её увидит клиент"
                error={reasonError ?? undefined}
                required
              >
                {(control) => (
                  <Textarea
                    {...control}
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                )}
              </Field>

              <div className={styles.buttons}>
                <Button variant="ghost" onClick={() => setCancelling(false)}>
                  Назад
                </Button>
                <Button variant="danger" loading={close.isPending} onClick={submitCancel}>
                  Отменить запись
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setCancelling(true)}>
              Отменить запись
            </Button>
          )}
        </div>
      }
    >
      <div className={styles.head}>
        <StatusBadge status={item.status} />
        {isAwaiting(item) && (
          <span className={styles.awaiting}>
            <TriangleAlert aria-hidden="true" />
            Ждёт отметки
          </span>
        )}
      </div>

      <section className={styles.section}>
        <h3 className={styles.legend}>Клиент</h3>
        <p className={styles.value}>{item.client.name}</p>
        <a className={styles.link} href={`mailto:${item.client.email}`}>
          {item.client.email}
        </a>
        <a className={`${styles.link} tabular`} href={`tel:${item.client.phone}`}>
          {item.client.phone}
        </a>
        {/* Телефон записи может отличаться от телефона профиля (UC-U3) */}
        <p className={styles.note}>
          Телефон в записи:{" "}
          <a className={`${styles.link} tabular`} href={`tel:${item.phone}`}>
            {item.phone}
          </a>
        </p>
      </section>

      <section className={styles.section}>
        <h3 className={styles.legend}>Автомобиль</h3>
        <Link className={styles.carLink} to={`/catalog/${item.car.slug}`}>
          {item.car.name}
          <ArrowRight aria-hidden="true" />
        </Link>
      </section>

      {item.comment && (
        <section className={styles.section}>
          <h3 className={styles.legend}>Комментарий</h3>
          <p className={styles.value}>{item.comment}</p>
        </section>
      )}

      {item.cancelReason && (
        <section className={styles.section}>
          <h3 className={styles.legend}>Причина отмены</h3>
          <p className={styles.value}>{item.cancelReason}</p>
        </section>
      )}

      <p className={styles.note}>Создана {formatDateTime(item.createdAt)}</p>
    </DialogContent>
  );
}
