import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from "three";

export interface CarModelProps {
  /** Путь к GLB с бэкенда: `car.model3dPath`. */
  path: string;
  /** Имя материала краски — `car.paintMaterial`, не угадывается по содержимому GLB. */
  paintMaterial: string;
  /** Цвет кузова из палитры автомобиля (`hex`). Пусто — модель остаётся как есть. */
  colorHex: string | null;
  /** Модель разобрана и стоит в сцене — можно убирать полосу прогресса. */
  onReady: () => void;
}

/**
 * Модель автомобиля из GLB.
 *
 * Draco отключён намеренно: `useGLTF` по умолчанию подцепляет декодер Draco
 * с чужого CDN, а демо-модели не сжаты — на защите без интернета лишний
 * запрос ни к чему.
 *
 * Сцена из кэша `useGLTF` общая на все вызовы, поэтому красится не она,
 * а копия: иначе выбранный цвет утёк бы на другой автомобиль с той же моделью.
 * Копия объектов разделяет материалы с оригиналом, так что материал краски
 * клонируется отдельно — и освобождается при уходе со страницы.
 */
export function CarModel({ path, paintMaterial, colorHex, onReady }: CarModelProps) {
  const { scene } = useGLTF(path, false);

  const { root, paints } = useMemo(() => {
    const copy = scene.clone(true);
    const found: MeshStandardMaterial[] = [];

    copy.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const material: unknown = object.material;
      if (!(material instanceof MeshStandardMaterial)) return;
      if (material.name !== paintMaterial) return;

      const own = material.clone();
      object.material = own;
      found.push(own);
    });

    // Модель ставится на пол сцены и центрируется: так `ContactShadows`
    // ложится ровно под машину, а не куда придётся относительно начала
    // координат, выбранного автором модели.
    const box = new Box3().setFromObject(copy);
    const center = box.getCenter(new Vector3());
    copy.position.set(-center.x, -box.min.y, -center.z);

    return { root: copy, paints: found };
  }, [scene, paintMaterial]);

  useEffect(() => {
    return () => {
      for (const material of paints) material.dispose();
    };
  }, [paints]);

  useEffect(() => {
    onReady();
  }, [root, onReady]);

  useEffect(() => {
    if (colorHex === null) return;
    for (const material of paints) material.color.set(colorHex);
  }, [paints, colorHex]);

  return <primitive object={root} />;
}
