import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Environment, Lightformer, useEnvironment } from "@react-three/drei";
import type { WebGLRenderer } from "three";
import { GroundedSkybox } from "three/examples/jsm/objects/GroundedSkybox.js";
import { STUDIO_EXPOSURE, type PanoramaScene } from "./scenes";

function setExposure(gl: WebGLRenderer, value: number) {
  gl.toneMappingExposure = value;
}

/**
 * Стенд: студия из светящихся панелей, собранная в карту окружения прямо
 * в браузере — краска и стёкла отражают «софтбоксы». Файлов и внешних
 * запросов нет. Фон — CSS рамки, канва прозрачная.
 */
export function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer
        form="rect"
        intensity={3}
        position={[0, 6, 0]}
        rotation-x={Math.PI / 2}
        scale={[12, 6, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.6}
        position={[-7, 2.5, 0]}
        rotation-y={Math.PI / 2}
        scale={[14, 2.5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.6}
        position={[7, 2.5, 0]}
        rotation-y={-Math.PI / 2}
        scale={[14, 2.5, 1]}
      />
      <Lightformer form="rect" intensity={1} position={[0, 2, 9]} scale={[10, 4, 1]} />
      <Lightformer
        form="rect"
        intensity={0.8}
        position={[0, 2, -9]}
        rotation-y={Math.PI}
        scale={[10, 4, 1]}
      />
      {/* Пол студии: снизу в кузове отражается светлое, а не пустота */}
      <Lightformer
        form="rect"
        intensity={0.35}
        position={[0, -1, 0]}
        rotation-x={-Math.PI / 2}
        scale={[30, 30, 1]}
      />
    </Environment>
  );
}

/**
 * Город или улица: панорама и светит, и отражается, и служит фоном.
 * Нижняя половина проецируется на пол (GroundedSkybox), поэтому машина
 * стоит на асфальте, а не висит в шаре с картинкой. Пол — ровно на y = 0,
 * там же колёса и тень.
 *
 * Панорама грузится, только когда сцену выбрали: `useEnvironment`
 * подвешивает Suspense, и до загрузки остаётся стенд.
 */
export function PanoramaEnvironment({
  scene,
  onReady,
}: {
  scene: PanoramaScene;
  onReady: () => void;
}) {
  const texture = useEnvironment({ files: scene.file });
  const gl = useThree((state) => state.gl);

  const skybox = useMemo(() => {
    const mesh = new GroundedSkybox(texture, scene.height, scene.radius);
    mesh.position.y = scene.height;
    mesh.rotation.y = scene.rotation;
    return mesh;
  }, [texture, scene.height, scene.radius, scene.rotation]);

  useEffect(() => {
    return () => {
      skybox.geometry.dispose();
      skybox.material.dispose();
    };
  }, [skybox]);

  useEffect(() => {
    setExposure(gl, scene.exposure);
    return () => setExposure(gl, STUDIO_EXPOSURE);
  }, [gl, scene.exposure]);

  useEffect(() => {
    onReady();
  }, [skybox, onReady]);

  return (
    <>
      {/* Отражения повёрнуты вместе с фоном — иначе в кузове отражалась
          бы не та сторона улицы, что видна за ним */}
      <Environment
        map={texture}
        environmentIntensity={scene.intensity}
        environmentRotation={[0, scene.rotation, 0]}
      />
      <primitive object={skybox} />
    </>
  );
}
