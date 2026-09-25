import { Suspense, lazy, useState } from "react";
import { Images, Rotate3d } from "lucide-react";
import type { CarColor, CarDetails } from "@carshowroom/contracts";
import { Button, StatePanel } from "@/components/ui";
import { ColorPicker } from "./ColorPicker";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { ViewerProgress } from "./ViewerProgress";
import { isWebglAvailable } from "./webgl";
import styles from "./CarViewer.module.css";

// Весь three.js — за этой границей. Импорт исполняется в момент, когда
// компонент впервые рендерится, то есть при открытии вкладки «3D» (D11):
// посетитель, который её не открыл, сцену не качает.
const CarScene = lazy(() => import("./CarScene"));

export interface CarViewerProps {
  car: CarDetails;
  /** Переключить вкладку на «Фото» — кнопка запасного вида. */
  onShowPhotos: () => void;
}

/** Запасной вид: вкладка не исчезает молча, а объясняет причину и уводит к фото. */
function ViewerUnavailable({ reason, onShowPhotos }: { reason: string; onShowPhotos: () => void }) {
  return (
    <StatePanel
      variant="error"
      className={styles.unavailable}
      title="3D-просмотр недоступен"
      description={`${reason} Фотографии — на соседней вкладке.`}
      action={
        <Button iconStart={<Images aria-hidden="true" />} onClick={onShowPhotos}>
          К фотографиям
        </Button>
      }
    />
  );
}

/**
 * Вкладка «3D» страницы автомобиля (раздел 4 wireframes.md, UC-G3 п. 2).
 *
 * Три запасных пути, и ни один не молчит: нет WebGL — проверка до загрузки
 * кода сцены; не скачался чанк или GLB, упал three.js — граница ошибок.
 * В любом случае человек видит причину и кнопку к фотографиям.
 */
export function CarViewer({ car, onShowPhotos }: CarViewerProps) {
  // Проверка синхронная и одноразовая: пересчитывать её на каждый рендер
  // незачем, поддержка WebGL внутри вкладки не появляется и не исчезает
  const [webglReady] = useState(isWebglAvailable);
  // null — родной цвет модели: с него 3D и открывается
  const [color, setColor] = useState<CarColor | null>(null);
  // Родной цвет известен только после загрузки модели — он в GLB, не в базе
  const [originalHex, setOriginalHex] = useState<string | null>(null);

  const { model3dPath, paintMaterial } = car;
  const backdrop = car.images[0] ?? null;

  // В контракте путь и имя материала nullable и всегда идут вместе (CHECK
  // в схеме). Без них показывать нечего — вкладки в этом случае и нет.
  if (model3dPath === null || paintMaterial === null) return null;

  if (!webglReady) {
    return (
      <ViewerUnavailable reason="Браузер не поддерживает WebGL." onShowPhotos={onShowPhotos} />
    );
  }

  return (
    <SceneErrorBoundary
      fallback={<ViewerUnavailable reason="Модель не загрузилась." onShowPhotos={onShowPhotos} />}
    >
      <div className={styles.viewer}>
        <div className={styles.frame}>
          <Suspense fallback={<ViewerProgress progress={null} backdrop={backdrop} />}>
            <CarScene
              path={model3dPath}
              paintMaterial={paintMaterial}
              colorHex={color?.hex ?? null}
              backdrop={backdrop}
              onModelReady={setOriginalHex}
            />
          </Suspense>
        </div>

        <p className={styles.hint}>
          <Rotate3d aria-hidden="true" />
          Перетащить — повернуть · правая кнопка или два пальца — сдвинуть · колесо —
          приблизить к курсору · двойной клик — рассмотреть деталь
        </p>

        {originalHex !== null && (
          <ColorPicker
            colors={car.colors}
            originalHex={originalHex}
            selected={color}
            onSelect={setColor}
          />
        )}
      </div>
    </SceneErrorBoundary>
  );
}
