import { Suspense, useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraControls, ContactShadows, useProgress } from "@react-three/drei";
import {
  Box3,
  DoubleSide,
  Material,
  Mesh,
  NeutralToneMapping,
  Vector3,
  type Group,
} from "three";
import { RotateCcw } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { CAR_LENGTH, CarModel } from "./CarModel";
import { PanoramaEnvironment, StudioEnvironment } from "./SceneEnvironment";
import { SCENE_IDS, SCENES, STUDIO_EXPOSURE, type SceneId } from "./scenes";
import { ViewerProgress } from "./ViewerProgress";
import styles from "./CarViewer.module.css";

export interface CarSceneProps {
  path: string;
  paintMaterial: string;
  colorHex: string | null;
  backdrop: { path: string; alt: string } | null;
  /** Модель загружена; `originalHex` — родной цвет её краски. */
  onModelReady: (originalHex: string) => void;
}

// Модель приведена к длине CAR_LENGTH (см. CarModel), поэтому камера
// и пределы задаются в метрах сцены, одинаково для всех машин.
const HOME_POSITION = [4.3, 1.6, 4.7] as const;
const HOME_TARGET = [0, 0.55, 0] as const;
/** Ближе этого камера не подходит — иначе влетает в кузов. */
const MIN_DISTANCE = 1.2;
const MAX_DISTANCE = 12;
/** Расстояние до детали после двойного клика. */
const FOCUS_DISTANCE = 1.8;
/** Точка взгляда не уходит дальше этой рамки вокруг машины. */
const TARGET_BOUNDS = new Box3(
  new Vector3(-CAR_LENGTH * 0.6, 0.05, -CAR_LENGTH * 0.45),
  new Vector3(CAR_LENGTH * 0.6, 1.8, CAR_LENGTH * 0.45),
);

/**
 * В связке drei 10.7 + three 0.186 лицевая сторона плоскости ContactShadows
 * смотрит вниз, и сверху тени не видно вовсе. Камера под пол не опускается
 * (maxPolarAngle), поэтому плоскость просто делается двусторонней.
 */
function showShadowFromAbove(group: Group | null) {
  const plane = group?.children.find((child) => child instanceof Mesh);
  if (plane instanceof Mesh && plane.material instanceof Material) {
    plane.material.side = DoubleSide;
  }
}

/**
 * Сама сцена — весь three.js живёт здесь.
 *
 * Модуль грузится только через `React.lazy` из CarViewer (D11): открыл
 * вкладку «3D» — поехал чанк; не открыл — на странице нет ни байта three.js.
 *
 * Окружение выбирается переключателем: стенд (студия без файлов) или
 * панорама города / улицы — см. SceneEnvironment.
 *
 * Управление — CameraControls: колесо приближает к курсору, а не к центру;
 * правая кнопка (два пальца) сдвигает точку взгляда в пределах машины;
 * двойной клик по кузову подлетает к этой детали.
 */
export default function CarScene({
  path,
  paintMaterial,
  colorHex,
  backdrop,
  onModelReady,
}: CarSceneProps) {
  const { progress } = useProgress();
  const [ready, setReady] = useState(false);
  const controls = useRef<CameraControls>(null);

  const handleReady = useCallback(
    (originalHex: string) => {
      setReady(true);
      onModelReady(originalHex);
    },
    [onModelReady],
  );

  // Callback ref, а не эффект: контролы создаёт рендерер канвы, и эффект
  // этого компонента мог бы отработать раньше, чем они появятся
  const attachControls = useCallback((instance: CameraControls | null) => {
    if (instance && controls.current !== instance) {
      instance.setBoundary(TARGET_BOUNDS);
      void instance.setLookAt(...HOME_POSITION, ...HOME_TARGET, false);
    }
    controls.current = instance;
  }, []);

  const focusOn = useCallback((point: Vector3) => {
    const camera = controls.current;
    if (!camera) return;
    // Угол обзора сохраняется — камера подлетает к детали по той же линии,
    // по которой на неё сейчас смотрят
    const direction = camera.camera.position
      .clone()
      .sub(camera.getTarget(new Vector3()))
      .normalize();
    const position = point.clone().addScaledVector(direction, FOCUS_DISTANCE);
    void camera.setLookAt(position.x, position.y, position.z, point.x, point.y, point.z, true);
  }, []);

  function resetView() {
    void controls.current?.setLookAt(...HOME_POSITION, ...HOME_TARGET, true);
  }

  const [sceneId, setSceneId] = useState<SceneId>("studio");
  // Какая панорама уже стоит в сцене: пока выбранная не догрузилась,
  // на её кнопке крутится спиннер
  const [loadedScene, setLoadedScene] = useState<SceneId>("studio");
  const markSceneLoaded = useCallback(() => setLoadedScene(sceneId), [sceneId]);
  const sceneLoading = sceneId !== "studio" && loadedScene !== sceneId;

  return (
    <>
      <Canvas
        className={styles.canvas}
        camera={{ position: [...HOME_POSITION], fov: 35, near: 0.05, far: 100 }}
        // Не ниже 2: на обычном мониторе сцена рендерится с запасом и
        // сглаживается при выводе — без этого на кромках кузова видны
        // пиксели. Не выше 2: на 4K-экране втрое больше пикселей
        // съедает кадры, и вращение начинает дёргаться.
        dpr={2}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          // Neutral передаёт цвет краски честнее ACES, который уводит
          // насыщенные цвета в жёлтый и пережимает светлые
          gl.toneMapping = NeutralToneMapping;
          gl.toneMappingExposure = STUDIO_EXPOSURE;
        }}
      >
        {sceneId === "studio" ? (
          <StudioEnvironment />
        ) : (
          // Пока панорама едет, вокруг машины остаётся стенд
          <Suspense fallback={<StudioEnvironment />}>
            <PanoramaEnvironment
              key={sceneId}
              scene={SCENES[sceneId]}
              onReady={markSceneLoaded}
            />
          </Suspense>
        )}

        <Suspense fallback={null}>
          <CarModel
            path={path}
            paintMaterial={paintMaterial}
            colorHex={colorHex}
            onReady={handleReady}
            onFocusPoint={focusOn}
          />
          <ContactShadows
            ref={showShadowFromAbove}
            // Строго не выше нуля: drei рисует плоскость размытия в мировом
            // y = 0 камерой тени, смотрящей вверх из этой точки. Поднять тень
            // над полом — и размытие получит пустоту и сотрёт тень целиком.
            position={[0, -0.001, 0]}
            scale={CAR_LENGTH * 2.4}
            resolution={1024}
            opacity={0.9}
            blur={2}
            far={1.2}
          />
        </Suspense>

        <CameraControls
          ref={attachControls}
          makeDefault
          dollyToCursor
          minDistance={MIN_DISTANCE}
          maxDistance={MAX_DISTANCE}
          // Ниже пола камера не уходит: машина стоит на тени, и вид
          // снизу сквозь землю выглядит поломкой, а не ракурсом
          maxPolarAngle={Math.PI / 2 - 0.04}
          smoothTime={0.2}
          draggingSmoothTime={0.08}
        />
      </Canvas>

      {ready && (
        <div className={styles.scenes} role="group" aria-label="Сцена">
          {SCENE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={styles.sceneButton}
              aria-pressed={id === sceneId}
              aria-busy={(id === sceneId && sceneLoading) || undefined}
              onClick={() => setSceneId(id)}
            >
              {SCENES[id].label}
              {id === sceneId && sceneLoading && <Spinner size="sm" label={null} />}
            </button>
          ))}
        </div>
      )}

      {ready && (
        <Button
          size="sm"
          variant="secondary"
          iconStart={<RotateCcw aria-hidden="true" />}
          className={styles.reset}
          onClick={resetView}
        >
          Исходный вид
        </Button>
      )}

      {/* Прогресс держится до готовности модели, а не до `active` из drei:
          на второй заход модель берётся из кэша, загрузчик не стартует,
          и полоса иначе зависла бы поверх готовой сцены */}
      {!ready && <ViewerProgress progress={progress} backdrop={backdrop} />}
    </>
  );
}
