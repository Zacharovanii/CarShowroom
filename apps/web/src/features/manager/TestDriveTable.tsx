import { ChevronRight, TriangleAlert } from "lucide-react";
import type { ManagerTestDrive } from "@carshowroom/contracts";
import { Skeleton, StatusBadge } from "@/components/ui";
import { isAwaiting } from "./status";
import styles from "./TestDriveTable.module.css";

export interface TestDriveTableProps {
  items: ManagerTestDrive[];
  onOpen: (item: ManagerTestDrive) => void;
}

/**
 * Записи дня (UC-M1). Одна и та же разметка на всех ширинах: на телефоне
 * строки таблицы раскладываются карточками средствами CSS, а не второй
 * копией списка в DOM.
 *
 * «Ждёт отметки» помечено дважды — тонировкой строки и словами: цвет
 * один сообщением быть не может (WCAG 1.4.1).
 */
export function TestDriveTable({ items, onOpen }: TestDriveTableProps) {
  return (
    <table className={styles.table}>
      <thead className={styles.head}>
        <tr>
          <th scope="col">Время</th>
          <th scope="col">Автомобиль</th>
          <th scope="col">Клиент</th>
          <th scope="col">Статус</th>
          <th scope="col">
            <span className="visually-hidden">Открыть запись</span>
          </th>
        </tr>
      </thead>

      <tbody>
        {items.map((item) => (
          <tr
            key={item.id}
            data-awaiting={isAwaiting(item) || undefined}
            className={styles.row}
            onClick={() => onOpen(item)}
          >
            <td className={`${styles.time} tabular`}>{item.time}</td>

            <td className={styles.car}>{item.car.name}</td>

            <td className={styles.client}>
              <span className={styles.stack}>
                <span className={styles.name}>{item.client.name}</span>
                <span className={`${styles.phone} tabular`}>{item.client.phone}</span>
              </span>
            </td>

            <td className={styles.status}>
              <span className={styles.stack}>
                <StatusBadge status={item.status} />
                {isAwaiting(item) && (
                  <span className={styles.awaiting}>
                    <TriangleAlert aria-hidden="true" />
                    Ждёт отметки
                  </span>
                )}
              </span>
            </td>

            <td className={styles.open}>
              {/* Настоящая кнопка: по строке кликает мышь, а с клавиатуры
                  запись открывается отсюда — обработчик у `tr` этого не даёт. */}
              <button
                type="button"
                className={styles.openButton}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen(item);
                }}
              >
                <span className="visually-hidden">
                  Открыть запись {item.time}, {item.client.name}
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Скелетон на время первой загрузки дня: полный рабочий день — 9 слотов (TD-2). */
export function TestDriveTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className={styles.skeleton} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.skeletonRow}>
          <Skeleton width="30%" />
          <Skeleton width="60%" />
          <Skeleton width="80%" />
          <Skeleton width="50%" />
        </div>
      ))}
    </div>
  );
}
