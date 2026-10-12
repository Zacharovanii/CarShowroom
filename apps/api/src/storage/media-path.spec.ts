import { isMediaPath, isValidKey, keyFromMediaPath, mediaPathFromKey } from "./media-path.js";

// Ключ приходит в /media/* прямо из URL, поэтому граница допустимого
// проверяется явно, а не только на ключах, которые генерирует сам API.

describe("media-path", () => {
  it.each(["cars/0d4c/1f2e.webp", "a", "test/x_y-z.txt", "a/b/c/d.glb"])(
    "ключ %s допустим",
    (key) => {
      expect(isValidKey(key)).toBe(true);
    },
  );

  it.each([
    ["пустой", ""],
    ["..", "cars/../x"],
    [".. внутри имени", "cars/a..b"],
    ["ведущий /", "/cars/x.webp"],
    ["двойной /", "cars//x.webp"],
    ["конечный /", "cars/x/"],
    ["заглавные", "Cars/X.webp"],
    ["пробел", "cars/x y.webp"],
    ["обратный слэш", "cars\\x.webp"],
    ["кириллица", "машины/x.webp"],
    ["%", "cars/%2e%2e"],
  ])("ключ недопустим: %s", (_name, key) => {
    expect(isValidKey(key)).toBe(false);
  });

  it("путь и ключ переводятся друг в друга без потерь", () => {
    const key = "cars/0d4c/1f2e.webp";
    expect(mediaPathFromKey(key)).toBe("/media/cars/0d4c/1f2e.webp");
    expect(keyFromMediaPath(mediaPathFromKey(key))).toBe(key);
    expect(isMediaPath(mediaPathFromKey(key))).toBe(true);
  });

  it("/assets/... и невалидный /media/... — не объекты MinIO", () => {
    expect(keyFromMediaPath("/assets/cars/x.webp")).toBeUndefined();
    expect(isMediaPath("/assets/cars/x.webp")).toBe(false);
    expect(keyFromMediaPath("/media/../x")).toBeUndefined();
    expect(keyFromMediaPath("/media/")).toBeUndefined();
    expect(isMediaPath("/media/Cars/x.webp")).toBe(false);
  });
});
