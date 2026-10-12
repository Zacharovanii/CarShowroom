import { Link } from "react-router-dom";
import { ImageOff } from "lucide-react";
import { ADMIN_CARS_PAGE_SIZE, type AdminCarListItem } from "@carshowroom/contracts";
import { Badge, Skeleton } from "@/components/ui";
import { formatMoney } from "@/shared/format";
import styles from "./AdminCarsList.module.css";

export interface AdminCarsListProps {
  cars: AdminCarListItem[];
  /** Телефон: вместо таблицы — карточки, как у списка пользователей. */
  compact: boolean;
}

/** Первый столбец — миниатюра, у неё подписи нет: скринридеру хватает названия. */
const COLUMNS = ["Фото", "Название", "Серия", "Год", "Цена", "Статус"];

/** Столько строк-заглушек рисует скелетон. */
const SKELETON_ROWS = 6;

function adminCarPath(id: number): string {
  return `/admin/cars/${id}`;
}

/**
 * Обложка — первое фото. У черновика фото может не быть, тогда на её месте
 * нейтральная заглушка той же формы, чтобы строки не прыгали по высоте.
 * Подпись у миниатюры пустая: рядом стоит название, повторять его незачем.
 */
function Thumb({ path }: { path: string | null }) {
  if (path === null) {
    return (
      <span className={styles.thumb}>
        <ImageOff aria-hidden="true" className={styles.thumbIcon} />
      </span>
    );
  }
  return <img src={path} alt="" loading="lazy" className={styles.thumb} />;
}

function badges(car: AdminCarListItem) {
  return (
    <span className={styles.badges}>
      {car.isPublished ? (
        <Badge tone="success" dot>
          Опубликован
        </Badge>
      ) : (
        <Badge dot>Черновик</Badge>
      )}
      {car.has3d && <Badge tone="info">3D</Badge>}
    </span>
  );
}

/**
 * Каждая строка ведёт на редактирование. Ссылка одна — на названии, а
 * кликабельной всю строку делает её растянутый псевдоэлемент: так Tab
 * проходит по одной ссылке на машину, а не по каждой ячейке.
 */
export function AdminCarsList({ cars, compact }: AdminCarsListProps) {
  if (compact) {
    return (
      <ul className={styles.cards}>
        {cars.map((car) => (
          <li key={car.id} className={styles.card}>
            <Thumb path={car.coverPath} />
            <div className={styles.cardBody}>
              <Link to={adminCarPath(car.id)} className={styles.name}>
                {car.name}
              </Link>
              <span className={styles.meta}>
                {car.seriesName} · {car.modelYear}
              </span>
              <span className={styles.price}>{formatMoney(car.price)}</span>
              {badges(car)}
            </div>
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
            {COLUMNS.map((column, index) => (
              <th key={column} scope="col" className={styles.th}>
                {index === 0 ? <span className="visually-hidden">{column}</span> : column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cars.map((car) => (
            <tr key={car.id} className={styles.row}>
              <td className={styles.td}>
                <Thumb path={car.coverPath} />
              </td>
              <td className={styles.td}>
                <Link to={adminCarPath(car.id)} className={styles.name}>
                  {car.name}
                </Link>
              </td>
              <td className={styles.td}>{car.seriesName}</td>
              <td className={styles.td}>
                <span className={styles.number}>{car.modelYear}</span>
              </td>
              <td className={styles.td}>
                <span className={styles.price}>{formatMoney(car.price)}</span>
              </td>
              <td className={styles.td}>{badges(car)}</td>
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
export function AdminCarsListSkeleton({ compact }: { compact: boolean }) {
  const rows = Math.min(SKELETON_ROWS, ADMIN_CARS_PAGE_SIZE);

  if (compact) {
    return (
      <ul className={styles.cards} aria-busy="true">
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className={styles.card}>
            <span className={styles.thumbSlot}>
              <Skeleton variant="block" ratio="3 / 2" />
            </span>
            <div className={styles.cardBody}>
              <Skeleton width="70%" />
              <Skeleton width="45%" />
              <Skeleton width="35%" />
            </div>
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
            {COLUMNS.map((column, index) => (
              <th key={column} scope="col" className={styles.th}>
                {index === 0 ? <span className="visually-hidden">{column}</span> : column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, index) => (
            <tr key={index} className={styles.row}>
              {COLUMNS.map((column, columnIndex) => (
                <td key={column} className={styles.td}>
                  {columnIndex === 0 ? (
                    <span className={styles.thumbSlot}>
                      <Skeleton variant="block" ratio="3 / 2" />
                    </span>
                  ) : (
                    <Skeleton width="80%" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
