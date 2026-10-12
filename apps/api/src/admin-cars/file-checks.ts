import { AppError } from "../common/app-error.js";

// Лимиты нужны и здесь, и в multer limits контроллера: multer обрывает
// загрузку раньше, чем файл целиком окажется в памяти.
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const MODEL_MAX_BYTES = 60 * 1024 * 1024;

export const GLB_CONTENT_TYPE = "model/gltf-binary";

type ImageExt = "jpg" | "png" | "webp" | "avif";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const AVIF_BRANDS = new Set(["avif", "avis"]);

function ascii(buffer: Buffer, start: number, end: number): string {
  return buffer.toString("latin1", start, end);
}

// AVIF — контейнер ISOBMFF: бокс ftyp с major brand и списком compatible
// brands. Кодировщики пишут avif то в major, то только в compatible
// (major mif1), поэтому смотрим оба места, но не дальше границ бокса.
function isAvif(buffer: Buffer): boolean {
  if (buffer.length < 12 || ascii(buffer, 4, 8) !== "ftyp") return false;
  if (AVIF_BRANDS.has(ascii(buffer, 8, 12))) return true;
  const boxEnd = Math.min(buffer.readUInt32BE(0), buffer.length);
  // 8..12 — major brand, 12..16 — minor version, дальше compatible brands по 4 байта.
  for (let offset = 16; offset + 4 <= boxEnd; offset += 4) {
    if (AVIF_BRANDS.has(ascii(buffer, offset, offset + 4))) return true;
  }
  return false;
}

/**
 * Формат фото по сигнатуре файла. Mimetype и имя от клиента не используются:
 * их подделать проще, чем первые байты, а расширение потом попадает в путь,
 * который проверяет CHECK в БД.
 */
export function detectImage(buffer: Buffer): { ext: ImageExt; contentType: string } {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { ext: "png", contentType: "image/png" };
  }
  if (buffer.length >= 12 && ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 12) === "WEBP") {
    return { ext: "webp", contentType: "image/webp" };
  }
  if (isAvif(buffer)) {
    return { ext: "avif", contentType: "image/avif" };
  }
  throw new AppError("INVALID_FILE", "Фото должно быть JPEG, PNG, WebP или AVIF");
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const GLB_HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

function invalidGlb(): AppError {
  return new AppError("INVALID_FILE", "Модель должна быть файлом GLB 2.0");
}

/**
 * Имена материалов из JSON-чанка GLB 2.0. Нужны, чтобы до сохранения
 * убедиться, что в модели есть материал кузова, который красит фронт.
 * Безымянные материалы пропускаются — сослаться на них по имени нельзя.
 */
export function readGlbMaterials(buffer: Buffer): string[] {
  if (buffer.length < GLB_HEADER_BYTES + CHUNK_HEADER_BYTES) throw invalidGlb();
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw invalidGlb();
  if (buffer.readUInt32LE(4) !== 2) throw invalidGlb();
  if (buffer.readUInt32LE(8) !== buffer.length) throw invalidGlb();

  // По спецификации первый чанк всегда JSON.
  const chunkLength = buffer.readUInt32LE(12);
  if (buffer.readUInt32LE(16) !== CHUNK_JSON) throw invalidGlb();
  const start = GLB_HEADER_BYTES + CHUNK_HEADER_BYTES;
  if (chunkLength > buffer.length - start) throw invalidGlb();

  let json: unknown;
  try {
    // Паддинг чанка — пробелы, JSON.parse их пропускает.
    json = JSON.parse(buffer.toString("utf8", start, start + chunkLength));
  } catch {
    throw invalidGlb();
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) throw invalidGlb();

  const materials = (json as { materials?: unknown }).materials;
  if (materials === undefined) return [];
  if (!Array.isArray(materials)) throw invalidGlb();

  const names: string[] = [];
  for (const material of materials as unknown[]) {
    const name = (material as { name?: unknown } | null)?.name;
    if (typeof name === "string") names.push(name);
  }
  return names;
}
