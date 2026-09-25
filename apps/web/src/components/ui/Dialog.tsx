import type { ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { X } from "lucide-react";
import styles from "./Dialog.module.css";

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/** Фокус-ловушка, Esc, возврат фокуса и `aria-modal` — Radix Dialog (D10). */
export function Dialog({ open, defaultOpen, onOpenChange, children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {children}
    </RadixDialog.Root>
  );
}

export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

/**
 * Где окно стоит на экране:
 * - `center` — по центру, обычный диалог;
 * - `side` — панель у правого края во всю высоту; на телефоне сама
 *   становится листом снизу, потому что у правого края там нет места;
 * - `sheet` — лист снизу во всю ширину.
 */
export type DialogPlacement = "center" | "side" | "sheet";

export interface DialogContentProps {
  title: string;
  description?: ReactNode;
  /** Кнопки внизу: обычно «отмена» и подтверждение. Строка не уезжает при прокрутке. */
  footer?: ReactNode;
  placement?: DialogPlacement;
  children?: ReactNode;
  className?: string;
  /** Классы на части окна: раскладка шапки, тела и подошвы — дело экрана. */
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

/**
 * Окно из трёх частей: шапка с заголовком и крестиком, тело и подошва.
 * Прокручивается **только тело** — заголовок и кнопки остаются на виду,
 * поэтому действия кладутся в `footer`, а не в поток содержимого.
 */
export function DialogContent({
  title,
  description,
  footer,
  placement = "center",
  children,
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
}: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={styles.overlay} />
      <RadixDialog.Content data-placement={placement} className={clsx(styles.content, className)}>
        <div className={clsx(styles.head, headerClassName)}>
          <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
          <RadixDialog.Close aria-label="Закрыть" className={styles.close}>
            <X aria-hidden="true" />
          </RadixDialog.Close>
        </div>

        <div className={clsx(styles.body, bodyClassName)}>
          {description && (
            <RadixDialog.Description className={styles.description}>
              {description}
            </RadixDialog.Description>
          )}
          {children}
        </div>

        {footer && <div className={clsx(styles.foot, footerClassName)}>{footer}</div>}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
