/**
 * Есть ли в браузере WebGL.
 *
 * Проверяется один раз и руками, до загрузки сцены: если контекста нет,
 * тянуть мегабайты three.js незачем — вкладка сразу показывает запасной вид.
 * Контекст тут же теряется (`loseContext`), чтобы проверка не занимала
 * один из нескольких WebGL-контекстов, которые браузер держит на вкладку.
 */
export function isWebglAvailable(): boolean {
  if (typeof document === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (gl === null) return false;

    const lose = gl.getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return true;
  } catch {
    // Firefox с отключённым WebGL кидает исключение вместо null
    return false;
  }
}
