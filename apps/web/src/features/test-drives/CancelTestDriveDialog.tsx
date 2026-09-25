import { useState } from "react";
import type { TestDrive } from "@carshowroom/contracts";
import { Alert, Button, Dialog, DialogContent, useToast } from "@/components/ui";
import { formatDateTime } from "@/shared/format";
import { cancelErrorMessage } from "./bookingError";
import { useCancelTestDrive } from "./useTestDrives";
import styles from "./CancelTestDriveDialog.module.css";

export interface CancelTestDriveDialogProps {
  /** Отменяемая запись; `null` — диалог закрыт. */
  item: TestDrive | null;
  onClose: () => void;
}

/** Подтверждение отмены (UC-U4): отмена освобождает слот, шаг необратим. */
export function CancelTestDriveDialog({ item, onClose }: CancelTestDriveDialogProps) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      {item && <Body key={item.id} item={item} onClose={onClose} />}
    </Dialog>
  );
}

function Body({ item, onClose }: { item: TestDrive; onClose: () => void }) {
  const toast = useToast();
  const cancel = useCancelTestDrive();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    cancel.mutate(item.id, {
      onSuccess: () => {
        toast({ tone: "success", description: "Запись отменена, время освободилось" });
        onClose();
      },
      onError: (failure) => setError(cancelErrorMessage(failure)),
    });
  }

  return (
    <DialogContent
      title="Отменить запись?"
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose}>
            Не отменять
          </Button>
          <Button variant="danger" loading={cancel.isPending} onClick={submit}>
            Отменить запись
          </Button>
        </div>
      }
    >
      <p className={styles.text}>
        {item.car.name}, {formatDateTime(item.startsAt)}. Время освободится для других.
      </p>

      {error && <Alert variant="error">{error}</Alert>}
    </DialogContent>
  );
}
