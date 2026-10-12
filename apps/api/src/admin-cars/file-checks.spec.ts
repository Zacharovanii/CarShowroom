import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectImage, readGlbMaterials } from "./file-checks.js";

// Файлы собираются прямо в тесте из минимальных байтов: проверяется
// сигнатура, а не декодируемость картинки целиком.

function ftyp(major: string, compatible: string[] = []): Buffer {
  const size = 16 + compatible.length * 4;
  const box = Buffer.alloc(size);
  box.writeUInt32BE(size, 0);
  box.write("ftyp", 4, "latin1");
  box.write(major, 8, "latin1");
  compatible.forEach((brand, i) => box.write(brand, 16 + i * 4, "latin1"));
  return box;
}

function glb(
  json: unknown,
  opts: { version?: number; magic?: number; chunkType?: number } = {},
): Buffer {
  let text = JSON.stringify(json);
  while (Buffer.byteLength(text) % 4 !== 0) text += " ";
  const chunk = Buffer.from(text, "utf8");
  const header = Buffer.alloc(20);
  header.writeUInt32LE(opts.magic ?? 0x46546c67, 0);
  header.writeUInt32LE(opts.version ?? 2, 4);
  header.writeUInt32LE(20 + chunk.length, 8);
  header.writeUInt32LE(chunk.length, 12);
  header.writeUInt32LE(opts.chunkType ?? 0x4e4f534a, 16);
  return Buffer.concat([header, chunk]);
}

describe("detectImage", () => {
  it.each([
    ["JPEG", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]), "jpg", "image/jpeg"],
    [
      "PNG",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]),
      "png",
      "image/png",
    ],
    ["WebP", Buffer.from("RIFF\x24\x00\x00\x00WEBPVP8 ", "latin1"), "webp", "image/webp"],
    ["AVIF", ftyp("avif", ["mif1", "miaf"]), "avif", "image/avif"],
    ["AVIF с brand avis", ftyp("avis"), "avif", "image/avif"],
    ["AVIF с major mif1 и avif в compatible", ftyp("mif1", ["miaf", "avif"]), "avif", "image/avif"],
  ])("%s", (_name, buffer, ext, contentType) => {
    expect(detectImage(buffer)).toEqual({ ext, contentType });
  });

  it.each([
    ["пустой буфер", Buffer.alloc(0)],
    ["текст", Buffer.from("просто текст, не картинка")],
    ["обрезанный PNG", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d])],
    ["RIFF WAVE", Buffer.from("RIFF\x24\x00\x00\x00WAVEfmt ", "latin1")],
    ["ftyp mp42", ftyp("mp42", ["isom", "mp41"])],
    ["GIF", Buffer.from("GIF89a\x01\x00\x01\x00", "latin1")],
    // avif лежит за пределами объявленного размера бокса ftyp — не считается.
    [
      "avif за границей бокса ftyp",
      (() => {
        const box = ftyp("mif1", ["avif"]);
        box.writeUInt32BE(16, 0);
        return box;
      })(),
    ],
  ])("неверный формат: %s", (_name, buffer) => {
    expect(() => detectImage(buffer)).toThrow(expect.objectContaining({ code: "INVALID_FILE" }));
  });
});

describe("readGlbMaterials", () => {
  it("возвращает имена материалов, безымянные пропускает", () => {
    const file = glb({
      asset: { version: "2.0" },
      materials: [{ name: "CarPaint" }, { name: "Glass" }, { pbrMetallicRoughness: {} }],
    });
    expect(readGlbMaterials(file)).toEqual(["CarPaint", "Glass"]);
  });

  it("без materials — пустой список", () => {
    expect(readGlbMaterials(glb({ asset: { version: "2.0" } }))).toEqual([]);
  });

  it.each([
    ["неверный magic", glb({}, { magic: 0x12345678 })],
    ["version 1", glb({}, { version: 1 })],
    [
      "length не равен размеру",
      (() => {
        const file = glb({});
        file.writeUInt32LE(file.length + 4, 8);
        return file;
      })(),
    ],
    ["первый чанк BIN", glb({}, { chunkType: 0x004e4942 })],
    [
      "битый JSON",
      (() => {
        const file = glb({ a: 1 });
        file.write("{{{{", 20, "latin1");
        return file;
      })(),
    ],
    [
      "chunkLength за пределами буфера",
      (() => {
        const file = glb({});
        file.writeUInt32LE(1000, 12);
        return file;
      })(),
    ],
    ["JSON — не объект", glb([1, 2])],
    ["materials — не массив", glb({ materials: { name: "CarPaint" } })],
    ["буфер короче 20 байт", Buffer.from("glTF\x02\x00\x00\x00", "latin1")],
  ])("неверный GLB: %s", (_name, buffer) => {
    expect(() => readGlbMaterials(buffer)).toThrow(
      expect.objectContaining({ code: "INVALID_FILE" }),
    );
  });

  it("заглушка placeholder-car.glb содержит CarPaint", () => {
    const file = readFileSync(join(import.meta.dirname, "../../public/assets/placeholder-car.glb"));
    expect(readGlbMaterials(file)).toContain("CarPaint");
  });
});
