import { useId, useState, type FormEvent } from "react";
import { createManagerSchema } from "@carshowroom/contracts";
import {
  Alert,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Field,
  Input,
  useToast,
} from "@/components/ui";
import { fieldErrors, type FieldErrors } from "@/shared/form";
import { ApiError } from "@/shared/api";
import { useCreateManager } from "./useUsers";
import styles from "./CreateManagerDialog.module.css";

export interface CreateManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FormField = "name" | "email" | "phone" | "password";

/** Всё, что не разбирается по полям: сбой сети, 500, незнакомый код. */
const REQUEST_FAILED = "Не удалось создать менеджера. Попробуйте ещё раз.";

/**
 * Напоминание из UC-A2: писем мы не отправляем, пароль до сотрудника
 * доносит админ. Один текст на подсказку в форме и на тост после успеха.
 */
const PASSWORD_NOTE = "Передайте пароль сотруднику сами — писем мы не отправляем.";

/**
 * Содержимое диалога: форма в теле, кнопки в подошве. Обе части живут в одном
 * компоненте, потому что подошве нужно состояние запроса, а кнопка «Создать»
 * дотягивается до формы через `form={formId}` — она стоит вне тега `form`.
 */
function CreateManagerForm({ onDone }: { onDone: () => void }) {
  const formId = useId();
  const toast = useToast();
  const createManager = useCreateManager();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<FormField>>({});
  const [alert, setAlert] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Правила — только из контракта: тот же разбор, что и на сервере.
    const parsed = createManagerSchema.safeParse({ name, email, phone, password });
    if (!parsed.success) {
      setAlert(null);
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setAlert(null);

    try {
      await createManager.mutateAsync(parsed.data);
    } catch (error) {
      // Занятый email — ошибка своего поля, а не всей формы: поправить
      // нужно именно его. API отвечает 409 с кодом EMAIL_TAKEN.
      if (error instanceof ApiError && error.is("EMAIL_TAKEN")) {
        setErrors({ email: error.message });
        return;
      }
      setAlert(REQUEST_FAILED);
      return;
    }

    toast({
      tone: "success",
      title: "Менеджер создан",
      description: PASSWORD_NOTE,
    });
    onDone();
  }

  return (
    <DialogContent
      title="Создать менеджера"
      description="Сотрудник войдёт по этому email и временному паролю."
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">Отмена</Button>
          </DialogClose>
          <Button type="submit" form={formId} variant="primary" loading={createManager.isPending}>
            Создать
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
        <Field label="Имя" required error={errors.name}>
          {(control) => (
            <Input
              {...control}
              name="name"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>

        <Field label="Email" required error={errors.email}>
          {(control) => (
            <Input
              {...control}
              type="email"
              name="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>

        <Field label="Телефон" required error={errors.phone} hint="Формат +7XXXXXXXXXX">
          {(control) => (
            <Input
              {...control}
              type="tel"
              name="phone"
              autoComplete="off"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          )}
        </Field>

        <Field label="Временный пароль" required error={errors.password} hint={PASSWORD_NOTE}>
          {(control) => (
            <Input
              {...control}
              type="text"
              name="password"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        {alert && <Alert variant="error">{alert}</Alert>}
      </form>
    </DialogContent>
  );
}

/**
 * UC-A2. Роль в форме не выбирается: через интерфейс заводится только
 * менеджер. Содержимое рисуется только у открытого диалога, поэтому при
 * закрытии оно размонтируется — следующее открытие начинается с чистой формы.
 */
export function CreateManagerDialog({ open, onOpenChange }: CreateManagerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <CreateManagerForm onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}
