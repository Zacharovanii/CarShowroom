import { Link } from "react-router-dom";
import { ArrowRight, Box, ImageOff, Zap } from "lucide-react";
import type { CarCard as CarCardData } from "@carshowroom/contracts";
import { Badge, PriceTag } from "@/components/ui";
import styles from "./CarCard.module.css";

export interface CarCardProps {
  car: CarCardData;
  /** Первые карточки видны сразу — их фото грузится без lazy. */
  priority?: boolean;
}

/** Привод человеческим языком: в контракте это `rwd` / `xdrive`. */
function driveLabel(drive: CarCardData["driveType"]): string {
  return drive === "xdrive" ? "xDrive" : "задний";
}

/**
 * Электромобиль в карточке виден только по названию типа двигателя:
 * отдельного признака в `carCardSchema` нет, и заводить его ради бейджа
 * (то есть трогать контракт ради витрины) не стали.
 */
function isElectric(fuelTypeName: string): boolean {
  return fuelTypeName.trim().toLowerCase().startsWith("электро");
}

/**
 * Карточка каталога — горизонтальная: фото слева во всю высоту карточки,
 * характеристики справа обычным потоком, а не поверх снимка. Раньше текст
 * лежал на фото через блюр и затемнение — на тёмных машинах и в тёмной теме
 * кадр в итоге было почти не видно.
 *
 * Ссылка — сама карточка целиком, кнопка «Смотреть» внутри неё, а не второй
 * интерактивный элемент: иначе каждая карточка занимала бы две остановки
 * в табуляции.
 */
export function CarCard({ car, priority = false }: CarCardProps) {
  return (
    <Link to={`/catalog/${car.slug}`} className={styles.card}>
      <span className={styles.photoBox}>
        {car.coverPath ? (
          <img
            className={styles.photo}
            src={car.coverPath}
            alt={car.coverAlt ?? car.name}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
          />
        ) : (
          // Обложка в контракте nullable: у автомобиля без фото карточка
          // должна остаться карточкой, а не пустым прямоугольником.
          <span className={styles.noPhoto}>
            <ImageOff aria-hidden="true" />
          </span>
        )}

        {(car.has3d || isElectric(car.fuelTypeName)) && (
          <span className={styles.badges}>
            {car.has3d && <Badge icon={<Box aria-hidden="true" />}>3D</Badge>}
            {isElectric(car.fuelTypeName) && (
              <Badge icon={<Zap aria-hidden="true" />}>Электро</Badge>
            )}
          </span>
        )}
      </span>

      <span className={styles.body}>
        <span className={styles.top}>
          <span className={styles.name}>{car.name}</span>
          <span className={styles.year}>{car.modelYear}</span>
        </span>

        <PriceTag value={car.price} className={styles.price} />

        <span className={styles.specs}>
          <span className={styles.spec}>
            <b>{car.powerHp}</b>
            <span>л.с.</span>
          </span>
          <span className={styles.spec}>
            <b>{driveLabel(car.driveType)}</b>
            <span>привод</span>
          </span>
          <span className={styles.spec}>
            <b>{car.fuelTypeName.toLowerCase()}</b>
            <span>двигатель</span>
          </span>
        </span>

        <span className={styles.go}>
          <span className={styles.goLabel}>Смотреть</span>
          <ArrowRight aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}
