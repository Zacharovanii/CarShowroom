import { Link } from "react-router-dom";
import { ImageOff } from "lucide-react";
import type { TestDrive } from "@carshowroom/contracts";
import { Button, Card, Skeleton, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/shared/format";
import styles from "./TestDriveCard.module.css";

export interface TestDriveCardProps {
  item: TestDrive;
  onCancel: (item: TestDrive) => void;
}

/**
 * Карточка записи клиента (UC-U4, раздел 7 макетов). Кнопка «Отменить»
 * показывается по `cancellable` из контракта — правило TD-7 фронт
 * не повторяет.
 */
export function TestDriveCard({ item, onCancel }: TestDriveCardProps) {
  return (
    <Card className={styles.card}>
      {item.car.coverPath ? (
        <img className={styles.cover} src={item.car.coverPath} alt={item.car.coverAlt ?? ""} />
      ) : (
        <span className={styles.cover} aria-hidden="true">
          <ImageOff />
        </span>
      )}

      <div className={styles.body}>
        <div className={styles.top}>
          <Link to={`/catalog/${item.car.slug}`} className={styles.name}>
            {item.car.name}
          </Link>
          <StatusBadge status={item.status} />
        </div>

        <p className={styles.when}>{formatDateTime(item.startsAt)} (Мск)</p>

        <a className={`${styles.phone} tabular`} href={`tel:${item.phone}`}>
          {item.phone}
        </a>

        {item.comment && <p className={styles.comment}>«{item.comment}»</p>}

        {/* Причина приходит только у отмены менеджером (UC-U4) */}
        {item.cancelReason && <p className={styles.reason}>Причина: {item.cancelReason}</p>}
      </div>

      {item.cancellable && (
        <div className={styles.actions}>
          <Button onClick={() => onCancel(item)}>Отменить</Button>
        </div>
      )}
    </Card>
  );
}

/** Заглушки списка: те же карточки по месту, чтобы вкладка не прыгала. */
export function TestDriveCardSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className={styles.list} aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className={styles.card}>
          <Skeleton variant="block" className={styles.cover} />
          <div className={styles.body}>
            <Skeleton variant="title" width="50%" />
            <Skeleton width="40%" />
            <Skeleton width="30%" />
          </div>
        </Card>
      ))}
    </div>
  );
}
