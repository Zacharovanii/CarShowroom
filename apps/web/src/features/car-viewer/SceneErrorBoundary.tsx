import { Component, type ErrorInfo, type ReactNode } from "react";

export interface SceneErrorBoundaryProps {
  /** Что показать вместо сцены: тот же запасной вид, что и без WebGL. */
  fallback: ReactNode;
  children: ReactNode;
}

interface SceneErrorBoundaryState {
  failed: boolean;
}

/**
 * Граница ошибок вокруг всей 3D-сцены.
 *
 * Внутри неё три разных источника падений, и все они кидают при рендере:
 * не докачался ленивый чанк со сценой, не загрузился GLB (`useGLTF` кидает
 * промахнувшийся запрос), упал сам three.js. Без границы любое из этого
 * уронит всю страницу автомобиля — вместе с ценой и тест-драйвом.
 *
 * Сбрасывать состояние не нужно: при переходе на другой автомобиль
 * граница пересоздаётся по `key` со слагом.
 */
export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("3D-сцена упала", error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
