import { Suspense, useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, ContactShadows, OrbitControls, useProgress } from "@react-three/drei";
import { CarModel } from "./CarModel";
import { ViewerProgress } from "./ViewerProgress";
import styles from "./CarViewer.module.css";

export interface CarSceneProps {
  path: string;
  paintMaterial: string;
  colorHex: string | null;
  backdrop: { path: string; alt: string } | null;
}

/**
 * Сама сцена — весь three.js живёт здесь.
 *
 * Модуль грузится только через `React.lazy` из CarViewer (D11): открыл
 * вкладку «3D» — поехал чанк; не открыл — на странице нет ни байта three.js.
 * Поэтому ничего из этого файла не должно импортироваться напрямую.
 */
export default function CarScene({ path, paintMaterial, colorHex, backdrop }: CarSceneProps) {
  const { progress } = useProgress();
  const [ready, setReady] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);

  return (
    <>
      <Canvas
        className={styles.canvas}
        camera={{ position: [4.5, 2.4, 6], fov: 40 }}
        // Верхняя граница плотности пикселей: на ретине сцена остаётся
        // резкой, но не рендерится в четырёхкратном разрешении
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        {/* Освещение руками, без HDRI. `<Environment preset="…">` из drei
            качает карту окружения с чужого CDN в рантайме: без интернета
            вкладка встанет, а проект должен работать из коробки.

            МЕСТО ПОД HDRI: когда модели-заглушки заменят настоящими, сюда
            встанет <Environment files="/assets/hdri/<файл>.hdr" /> — файл
            локальный, из репозитория, рядом с моделями (см. assets-licenses.md).
            Свет ниже тогда останется как подсветка поверх окружения. */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 6, 4]} intensity={2.4} />
        <directionalLight position={[-5, 3, -6]} intensity={1.1} />

        <Suspense fallback={null}>
          {/* Bounds сам подгоняет камеру под габариты модели: заглушки
              Quaternius и будущие настоящие модели разного размера,
              а подбирать позицию камеры руками под каждую — тупик */}
          <Bounds fit clip observe margin={1.25}>
            <CarModel
              path={path}
              paintMaterial={paintMaterial}
              colorHex={colorHex}
              onReady={handleReady}
            />
          </Bounds>
          <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={14} blur={2.4} far={4} />
        </Suspense>

        <OrbitControls
          makeDefault
          enablePan={false}
          // Ниже пола камера не уходит: машина стоит на тени, и вид
          // снизу сквозь землю выглядит поломкой, а не ракурсом
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={0.2}
        />
      </Canvas>

      {/* Прогресс держится до готовности модели, а не до `active` из drei:
          на второй заход модель берётся из кэша, загрузчик не стартует,
          и полоса иначе зависла бы поверх готовой сцены */}
      {!ready && <ViewerProgress progress={progress} backdrop={backdrop} />}
    </>
  );
}
