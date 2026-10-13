import { useState, type ReactNode } from "react";
import type { CarDetails } from "@carshowroom/contracts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { CarViewer } from "@/features/car-viewer";
import { Gallery } from "./Gallery";
import styles from "./CarMedia.module.css";

export interface CarMediaProps {
  car: CarDetails;
  /** Слева от вкладок, в одной строке с ними — кнопка «В каталог». */
  leading?: ReactNode;
}

/**
 * Медиа автомобиля: вкладки «Фото» и «3D».
 *
 * Вкладка «3D» существует, только когда `model3dPath !== null`: у половины
 * демо-автомобилей модели нет, и пустая вкладка была бы обманом.
 *
 * Вкладки управляемые: запасной вид 3D уводит кнопкой «К фотографиям»,
 * а значит, переключать их умеет не только пользователь.
 */
export function CarMedia({ car, leading }: CarMediaProps) {
  const has3d = car.model3dPath !== null;
  const [tab, setTab] = useState("photo");

  // У автомобиля без модели вкладки «3D» нет, а состояние могло остаться
  // с прошлого автомобиля — тогда не показалось бы вообще ничего
  const value = has3d ? tab : "photo";

  return (
    <Tabs value={value} onValueChange={setTab} className={styles.media}>
      <div className={styles.bar}>
        {leading}
        <TabsList label="Медиа автомобиля" className={styles.tabs}>
          <TabsTrigger value="photo">Фото</TabsTrigger>
          {has3d && <TabsTrigger value="model">3D</TabsTrigger>}
        </TabsList>
      </div>

      <TabsContent value="photo">
        {/* key — по автомобилю: у новой машины галерея начинается
            с первого кадра, а не с того, что был выбран у прошлой */}
        <Gallery key={car.slug} images={car.images} carName={car.name} />
      </TabsContent>

      {has3d && (
        <TabsContent value="model">
          {/* key — по автомобилю: у нового автомобиля своя модель, своя
              палитра и своя граница ошибок, а не пережитки прошлого */}
          <CarViewer key={car.slug} car={car} onShowPhotos={() => setTab("photo")} />
        </TabsContent>
      )}
    </Tabs>
  );
}
