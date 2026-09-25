import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui";
import styles from "./FilterDisclosure.module.css";

export interface FilterDisclosureProps {
  activeFilterCount: number;
  children: ReactNode;
}

/**
 * Кнопка «Фильтры» и раскрывающаяся под ней панель — вместо статичной
 * боковой колонки и модалки на телефоне. Открывается и закрывается как
 * выпадающий список (клик мимо, Esc), но без Portal и без Radix: панель —
 * обычный `position: absolute` под кнопкой, того же вида, что и `Select`.
 */
export function FilterDisclosure({ activeFilterCount, children }: FilterDisclosureProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element;
      // `Select` внутри панели открывает свой список через портал в конец
      // <body> — он не потомок rootRef в DOM, хотя логически часть панели.
      // Клик по нему не должен закрывать панель раньше, чем Radix обработает
      // выбор пункта.
      if (rootRef.current?.contains(target)) return;
      if (target.closest("[data-radix-popper-content-wrapper]")) return;
      setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <Button
        iconStart={<SlidersHorizontal aria-hidden="true" />}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        Фильтры
        {activeFilterCount > 0 && <span className={styles.badge}>{activeFilterCount}</span>}
      </Button>

      {open && (
        <div id={panelId} className={styles.panel}>
          {children}
        </div>
      )}
    </div>
  );
}
