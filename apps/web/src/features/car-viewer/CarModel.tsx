import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { Box3, Color, Mesh, MeshStandardMaterial, Vector3, type Texture } from "three";

/** Длина машины в сцене, м. Все модели приводятся к ней — см. CarModel. */
export const CAR_LENGTH = 4.6;

export interface CarModelProps {
  /** Путь к GLB с бэкенда: `car.model3dPath`. */
  path: string;
  /** Имя материала краски — `car.paintMaterial`, не угадывается по содержимому GLB. */
  paintMaterial: string;
  /** Цвет кузова из палитры автомобиля. `null` — родной цвет модели. */
  colorHex: string | null;
  /** Модель стоит в сцене; `originalHex` — её родной цвет для палитры. */
  onReady: (originalHex: string) => void;
  /** Двойной клик по кузову — точка, которую хотят рассмотреть. */
  onFocusPoint: (point: Vector3) => void;
}

/** Родное состояние краски: к нему возвращается выбор «Оригинальный». */
interface Paint {
  material: MeshStandardMaterial;
  color: Color;
  map: Texture | null;
}

/**
 * Средний цвет текстуры — для кружка «Оригинальный», когда краска модели
 * не цвет, а рисунок (ливрея). Картинка ужимается до 16×16 с качественным
 * сглаживанием и усредняется: для образца цвета точнее не нужно.
 */
function averageColor(texture: Texture): string | null {
  const image = texture.image as CanvasImageSource | undefined;
  if (!image) return null;
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, size, size);
  const data = context.getImageData(0, 0, size, size).data;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }
  const count = data.length / 4;
  // Пиксели картинки уже в sRGB — как и hex, поэтому без перевода пространств
  const channel = (sum: number) =>
    Math.round(sum / count)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Красит кузов: `null` — вернуть родной цвет и рисунок модели. */
function applyPaint(paints: Paint[], colorHex: string | null) {
  for (const { material, color, map } of paints) {
    if (colorHex === null) material.color.copy(color);
    else material.color.set(colorHex);

    // Цвет из палитры ложится на чистый кузов: поверх ливреи он окрасил
    // бы рисунок, а не машину. Смена карты пересобирает шейдер — только
    // когда она действительно меняется.
    const nextMap = colorHex === null ? map : null;
    if (material.map !== nextMap) {
      material.map = nextMap;
      material.needsUpdate = true;
    }
  }
}

/**
 * Модель автомобиля из GLB.
 *
 * Draco отключён намеренно: `useGLTF` по умолчанию подцепляет декодер Draco
 * с чужого CDN, а модели не сжаты — лишний внешний запрос ни к чему.
 *
 * Сцена из кэша `useGLTF` общая на все вызовы, поэтому красится не она,
 * а копия, и материалы краски клонируются отдельно — иначе выбранный цвет
 * утёк бы на другой автомобиль с той же моделью.
 *
 * Модели с Sketchfab разного масштаба (метры, сантиметры, «как вышло»),
 * поэтому копия приводится к длине CAR_LENGTH и ставится колёсами на пол
 * по центру: от этого зависят камера, пределы зума и тень.
 */
export function CarModel({ path, paintMaterial, colorHex, onReady, onFocusPoint }: CarModelProps) {
  const { scene } = useGLTF(path, false);

  const { root, paints, originalHex } = useMemo(() => {
    const copy = scene.clone(true);
    const found: Paint[] = [];

    copy.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const material: unknown = object.material;
      if (!(material instanceof MeshStandardMaterial)) return;
      if (material.name !== paintMaterial) return;

      const own = material.clone();
      object.material = own;
      found.push({ material: own, color: own.color.clone(), map: own.map });
    });

    const box = new Box3().setFromObject(copy);
    const size = box.getSize(new Vector3());
    const scale = CAR_LENGTH / Math.max(size.x, size.z);
    const center = box.getCenter(new Vector3());
    copy.scale.setScalar(scale);
    copy.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

    // У некоторых моделей краска разбита на несколько материалов чуть разных
    // оттенков — в палитре родной цвет показывается по первому из них
    const first = found[0];
    const hex = first?.map
      ? (averageColor(first.map) ?? "#ffffff")
      : `#${first?.color.getHexString() ?? "ffffff"}`;

    return { root: copy, paints: found, originalHex: hex };
  }, [scene, paintMaterial]);

  useEffect(() => {
    return () => {
      for (const paint of paints) paint.material.dispose();
    };
  }, [paints]);

  useEffect(() => {
    onReady(originalHex);
  }, [root, originalHex, onReady]);

  useEffect(() => {
    applyPaint(paints, colorHex);
  }, [paints, colorHex]);

  function handleDoubleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onFocusPoint(event.point.clone());
  }

  return <primitive object={root} onDoubleClick={handleDoubleClick} />;
}
