// Путь в БД — готовый URL `/media/<key>` (как и `/assets/...`), а в MinIO
// объект лежит под голым ключом (D26). Переход между ними — только здесь.
export const MEDIA_PREFIX = "/media/";

// Ключи генерирует сам API (`cars/<uuid>/<uuid>.webp`), но в раздачу
// `/media/*` ключ приходит из URL — поэтому набор символов узкий, а `..`,
// ведущий и двойной `/` запрещены: такой путь не должен «выйти» за пределы
// ожидаемой структуры и по-разному читаться разными S3-реализациями.
const KEY_RE = /^[a-z0-9_.-]+(\/[a-z0-9_.-]+)*$/;

export function isValidKey(key: string): boolean {
  return KEY_RE.test(key) && !key.includes("..");
}

export function mediaPathFromKey(key: string): string {
  return `${MEDIA_PREFIX}${key}`;
}

/** Ключ объекта по пути из БД; `undefined` — путь не `/media/...` или ключ невалидный. */
export function keyFromMediaPath(path: string): string | undefined {
  if (!path.startsWith(MEDIA_PREFIX)) return undefined;
  const key = path.slice(MEDIA_PREFIX.length);
  return isValidKey(key) ? key : undefined;
}

/** `/assets/...` (seed и заглушки) из MinIO не удаляются никогда — отличаем их здесь. */
export function isMediaPath(path: string): boolean {
  return keyFromMediaPath(path) !== undefined;
}
