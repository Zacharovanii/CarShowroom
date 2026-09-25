import { USERS_PAGE_SIZE, type User } from "@carshowroom/contracts";
import { Badge, Skeleton } from "@/components/ui";
import { formatDateWithYear } from "@/shared/format";
import { ROLE_LABELS, ROLE_TONES } from "./roles";
import styles from "./UsersList.module.css";

export interface UsersListProps {
  users: User[];
  /** Телефон: вместо таблицы — карточки (раздел 9 макетов). */
  compact: boolean;
}

const COLUMNS = ["Имя", "Email", "Телефон", "Роль", "Регистрация"];

/** Столько строк-заглушек рисует скелетон: ровно страница списка. */
const SKELETON_ROWS = 6;

function roleBadge(user: User) {
  return <Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>;
}

export function UsersList({ users, compact }: UsersListProps) {
  if (compact) {
    return (
      <ul className={styles.cards}>
        {users.map((user) => (
          <li key={user.id} className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.name}>{user.name}</span>
              {roleBadge(user)}
            </div>
            <span className={styles.contact}>{user.email}</span>
            <span className={styles.contact}>{user.phone}</span>
            <span className={styles.date}>В салоне с {formatDateWithYear(user.createdAt)}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={styles.th}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className={styles.row}>
              <td className={styles.td}>
                <span className={styles.name}>{user.name}</span>
              </td>
              <td className={styles.td}>{user.email}</td>
              <td className={styles.td}>
                <span className={styles.date}>{user.phone}</span>
              </td>
              <td className={styles.td}>{roleBadge(user)}</td>
              <td className={styles.td}>
                <span className={styles.date}>{formatDateWithYear(user.createdAt)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Загрузка. Занятость объявляет контейнер через `aria-busy` — у самих
 * заглушек для скринридера содержимого нет.
 */
export function UsersListSkeleton({ compact }: { compact: boolean }) {
  const rows = Math.min(SKELETON_ROWS, USERS_PAGE_SIZE);

  if (compact) {
    return (
      <ul className={styles.cards} aria-busy="true">
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className={styles.card}>
            <div className={styles.cardHead}>
              <Skeleton width="45%" />
              <Skeleton width="25%" />
            </div>
            <Skeleton width="70%" />
            <Skeleton width="40%" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={styles.scroller} aria-busy="true">
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={styles.th}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, index) => (
            <tr key={index} className={styles.row}>
              {COLUMNS.map((column) => (
                <td key={column} className={styles.td}>
                  <Skeleton width="80%" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
