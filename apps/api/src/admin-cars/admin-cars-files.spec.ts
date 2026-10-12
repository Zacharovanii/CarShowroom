import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Test, type TestingModule } from "@nestjs/testing";
import { adminCarSchema, type CreateAdminCar } from "@carshowroom/contracts";
import { ConfigModule } from "../config/config.module.js";
import { DatabaseModule, SQL, type Sql } from "../db/db.module.js";
import { keyFromMediaPath } from "../storage/media-path.js";
import { StorageModule } from "../storage/storage.module.js";
import { StorageService } from "../storage/storage.service.js";
import { AdminCarsModule } from "./admin-cars.module.js";
import { AdminCarsService } from "./admin-cars.service.js";

// Фото и 3D-модель (UC-A5, UC-A6) поверх локальных базы и MinIO
// (npm run db:up): порядок «объект → транзакция», уборка объектов после
// коммита и после отката, позиции фото без дыр. Сигнатуры и разбор GLB
// подробно — file-checks.spec.ts, HTTP (multipart, лимиты, роли) —
// apps/api/test/admin-cars.e2e.spec.ts.
//
// Префикс slug свой, spec-afiles-, а не spec-acars-: файлы спеков идут
// параллельно, и afterEach из admin-cars.spec.ts удалял бы чужие машины.
// Объекты MinIO убираются по путям из БД перед удалением машин.

const PREFIX = "spec-afiles-";

// Файлы собираются из минимальных байтов: detectImage смотрит только сигнатуру.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = Buffer.from("RIFF\x24\x00\x00\x00WEBPVP8 ", "latin1");

/** GLB 2.0 из одного JSON-чанка — как в file-checks.spec.ts. */
function glb(materials: string[]): Buffer {
  let text = JSON.stringify({
    asset: { version: "2.0" },
    materials: materials.map((name) => ({ name })),
  });
  while (Buffer.byteLength(text) % 4 !== 0) text += " ";
  const chunk = Buffer.from(text, "utf8");
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); // "glTF"
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + chunk.length, 8);
  header.writeUInt32LE(chunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16); // "JSON"
  return Buffer.concat([header, chunk]);
}

const MISSING_ID = 999_999_999;

describe("Админ: фото и 3D-модель", () => {
  let moduleRef: TestingModule;
  let cars: AdminCarsService;
  let storage: StorageService;
  let sql: Sql;

  let base: Omit<CreateAdminCar, "name" | "slug">;
  /** Ключи, которые не найти по путям в БД (объект без строки): убираются в afterAll. */
  const keys: string[] = [];
  let counter = 0;

  const create = () => {
    counter += 1;
    return cars.createCar({ ...base, name: `Spec AFiles ${counter}`, slug: `${PREFIX}${counter}` });
  };

  const keyOf = (path: string): string => {
    const key = keyFromMediaPath(path);
    if (!key) throw new Error(`Путь ${path} — не /media/...`);
    return key;
  };

  /** Есть ли объект в MinIO; поток сразу закрывается, читать его незачем. */
  const exists = async (key: string): Promise<boolean> => {
    const object = await storage.get(key);
    object?.stream.destroy();
    return object !== undefined;
  };

  /** Шпион на put: из него берётся ключ объекта, который сервис потом должен убрать. */
  const spyPut = () => vi.spyOn(storage, "put");

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, StorageModule, AdminCarsModule],
    }).compile();

    await moduleRef.init();
    cars = moduleRef.get(AdminCarsService);
    storage = moduleRef.get(StorageService);
    sql = moduleRef.get<Sql>(SQL);

    const [refs] = await sql<{ seriesId: number; bodyTypeId: number; fuelTypeId: number }[]>`
      select (select min(id) from series)::int as series_id,
             (select min(id) from body_types)::int as body_type_id,
             (select min(id) from fuel_types)::int as fuel_type_id`;

    base = {
      seriesId: refs!.seriesId,
      bodyTypeId: refs!.bodyTypeId,
      fuelTypeId: refs!.fuelTypeId,
      driveType: "rwd",
      modelYear: 2026,
      description: "Тестовый автомобиль с файлами",
      powerHp: 300,
      accelerationS: "4.9",
      topSpeedKmh: 250,
      price: "5000000.00",
      colorIds: [],
    };
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    const rows = await sql<{ path: string }[]>`
      select i.path from car_images i join cars c on c.id = i.car_id
      where c.slug like ${PREFIX + "%"}
      union all
      select model_3d_path from cars
      where slug like ${PREFIX + "%"} and model_3d_path is not null`;
    await cars.deleteMediaObjects(rows.map((row) => row.path));
    await sql`delete from cars where slug like ${PREFIX + "%"}`;
  });

  afterAll(async () => {
    await Promise.all(keys.map((key) => storage.delete(key)));
    await moduleRef.close();
  });

  describe("addImage", () => {
    it("кладёт объект в MinIO и фото в конец: путь /media/cars/<id>/<uuid>.<ext>", async () => {
      const car = await create();

      const first = await cars.addImage(car.id, PNG, "Спереди");
      const second = await cars.addImage(car.id, JPEG, "Сбоку");
      const third = await cars.addImage(car.id, WEBP, "Сзади");

      expect(adminCarSchema.parse(third)).toEqual(third);
      expect(first.images).toHaveLength(1);
      expect(second.images).toHaveLength(2);
      expect(third.images.map((image) => [image.position, image.alt])).toEqual([
        [1, "Спереди"],
        [2, "Сбоку"],
        [3, "Сзади"],
      ]);

      const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
      const [png, jpg, webp] = third.images.map((image) => image.path);
      expect(png).toMatch(new RegExp(`^/media/cars/${car.id}/${uuid}\\.png$`));
      expect(jpg).toMatch(new RegExp(`^/media/cars/${car.id}/${uuid}\\.jpg$`));
      expect(webp).toMatch(new RegExp(`^/media/cars/${car.id}/${uuid}\\.webp$`));

      const object = await storage.get(keyOf(png!));
      object?.stream.destroy();
      expect(object).toMatchObject({ contentType: "image/png", contentLength: PNG.length });
      expect(await exists(keyOf(jpg!))).toBe(true);
      expect(await exists(keyOf(webp!))).toBe(true);
    });

    it("неверная сигнатура — INVALID_FILE до записи в MinIO", async () => {
      const car = await create();
      const put = spyPut();

      await expect(cars.addImage(car.id, Buffer.from("GIF89a"), "alt")).rejects.toMatchObject({
        code: "INVALID_FILE",
        status: 400,
      });
      expect(put).not.toHaveBeenCalled();
      expect((await cars.getCar(car.id)).images).toEqual([]);
    });

    it("нет автомобиля — NOT_FOUND, загруженный объект удаляется", async () => {
      const put = spyPut();

      await expect(cars.addImage(MISSING_ID, PNG, "alt")).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });

      expect(put).toHaveBeenCalledTimes(1);
      const key = put.mock.calls[0]![0];
      keys.push(key);
      expect(key).toMatch(new RegExp(`^cars/${MISSING_ID}/`));
      expect(await exists(key)).toBe(false);
    });
  });

  describe("replaceImageFile", () => {
    it("новый путь, id, position и alt те же; старый объект удаляется", async () => {
      const car = await create();
      await cars.addImage(car.id, PNG, "Первое");
      const before = await cars.addImage(car.id, PNG, "Второе");
      const old = before.images[1]!;

      const after = await cars.replaceImageFile(car.id, old.id, JPEG);

      const replaced = after.images[1]!;
      expect(replaced).toMatchObject({ id: old.id, position: 2, alt: "Второе" });
      expect(replaced.path).not.toBe(old.path);
      expect(replaced.path).toMatch(new RegExp(`^/media/cars/${car.id}/.+\\.jpg$`));
      expect(after.images[0]).toEqual(before.images[0]);

      expect(await exists(keyOf(replaced.path))).toBe(true);
      expect(await exists(keyOf(old.path))).toBe(false);
    });

    it("путь из seed (/assets/...) заменяется, MinIO при этом не трогается", async () => {
      const car = await create();
      const [image] = await sql<{ id: number }[]>`
        insert into car_images (car_id, position, path, alt)
        values (${car.id}, 1, ${`/assets/spec-afiles/${car.slug}-1.webp`}, 'Seed')
        returning id::int as id`;
      const remove = vi.spyOn(storage, "delete");

      const after = await cars.replaceImageFile(car.id, image!.id, WEBP);

      expect(after.images[0]).toMatchObject({ id: image!.id, position: 1, alt: "Seed" });
      expect(after.images[0]!.path).toMatch(/^\/media\/cars\//);
      expect(remove).not.toHaveBeenCalled();
    });

    it("неверная сигнатура — INVALID_FILE, фото не меняется", async () => {
      const car = await create();
      const before = await cars.addImage(car.id, PNG, "alt");

      await expect(
        cars.replaceImageFile(car.id, before.images[0]!.id, Buffer.from("text")),
      ).rejects.toMatchObject({ code: "INVALID_FILE" });
      expect(await cars.getCar(car.id)).toEqual(before);
    });

    it("нет автомобиля — NOT_FOUND, загруженный объект удаляется", async () => {
      const put = spyPut();

      await expect(cars.replaceImageFile(MISSING_ID, 1, PNG)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      const key = put.mock.calls[0]![0];
      keys.push(key);
      expect(await exists(key)).toBe(false);
    });
  });

  describe("фото чужого автомобиля или несуществующее — NOT_FOUND", () => {
    it("PATCH alt, замена файла и удаление не трогают чужое фото", async () => {
      const owner = await create();
      const other = await create();
      const before = await cars.addImage(owner.id, PNG, "Чужое");
      const imageId = before.images[0]!.id;
      const put = spyPut();

      await expect(cars.updateImageAlt(other.id, imageId, "x")).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
        details: { id: other.id, imageId },
      });
      await expect(cars.replaceImageFile(other.id, imageId, PNG)).rejects.toMatchObject({
        code: "NOT_FOUND",
        details: { imageId },
      });
      await expect(cars.deleteImage(other.id, imageId)).rejects.toMatchObject({
        code: "NOT_FOUND",
        details: { imageId },
      });
      await expect(cars.deleteImage(owner.id, MISSING_ID)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      // объект, загруженный заменой, после отказа удалён
      const key = put.mock.calls[0]![0];
      keys.push(key);
      expect(await exists(key)).toBe(false);

      expect(await cars.getCar(owner.id)).toEqual(before);
      expect(await exists(keyOf(before.images[0]!.path))).toBe(true);
    });
  });

  describe("updateImageAlt", () => {
    it("меняет только alt", async () => {
      const car = await create();
      const before = await cars.addImage(car.id, PNG, "Было");

      const after = await cars.updateImageAlt(car.id, before.images[0]!.id, "Стало");

      expect(after.images).toEqual([{ ...before.images[0]!, alt: "Стало" }]);
    });
  });

  describe("reorderImages", () => {
    it("переставляет фото, позиции 1..n", async () => {
      const car = await create();
      await cars.addImage(car.id, PNG, "a");
      await cars.addImage(car.id, PNG, "b");
      const before = await cars.addImage(car.id, PNG, "c");
      const [a, b, c] = before.images.map((image) => image.id);

      const after = await cars.reorderImages(car.id, [c!, a!, b!]);

      expect(after.images.map((image) => [image.id, image.position])).toEqual([
        [c, 1],
        [a, 2],
        [b, 3],
      ]);
    });

    it("неполный набор или чужое фото — VALIDATION_FAILED, порядок прежний", async () => {
      const car = await create();
      const other = await create();
      await cars.addImage(car.id, PNG, "a");
      const before = await cars.addImage(car.id, PNG, "b");
      const foreign = (await cars.addImage(other.id, PNG, "чужое")).images[0]!.id;
      const [a, b] = before.images.map((image) => image.id);

      for (const imageIds of [[b!], [b!, a!, foreign], [b!, foreign]]) {
        await expect(cars.reorderImages(car.id, imageIds)).rejects.toMatchObject({
          code: "VALIDATION_FAILED",
          status: 400,
          details: { field: "imageIds" },
        });
      }
      expect(await cars.getCar(car.id)).toEqual(before);
    });

    it("нет автомобиля — NOT_FOUND", async () => {
      await expect(cars.reorderImages(MISSING_ID, [1])).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("deleteImage", () => {
    it("удаляет среднее из трёх: позиции 1, 2, объект исчез", async () => {
      const car = await create();
      await cars.addImage(car.id, PNG, "a");
      await cars.addImage(car.id, PNG, "b");
      const before = await cars.addImage(car.id, PNG, "c");
      const [first, middle, last] = before.images;

      const after = await cars.deleteImage(car.id, middle!.id);

      expect(after.images.map((image) => [image.id, image.position])).toEqual([
        [first!.id, 1],
        [last!.id, 2],
      ]);
      expect(await exists(keyOf(middle!.path))).toBe(false);
      expect(await exists(keyOf(first!.path))).toBe(true);
    });

    it("последнее фото опубликованного — LAST_IMAGE, у черновика удаляется", async () => {
      const published = await create();
      const card = await cars.addImage(published.id, PNG, "Единственное");
      await cars.publishCar(published.id);
      const only = card.images[0]!;

      await expect(cars.deleteImage(published.id, only.id)).rejects.toMatchObject({
        code: "LAST_IMAGE",
        status: 409,
      });
      expect((await cars.getCar(published.id)).images).toEqual([only]);
      expect(await exists(keyOf(only.path))).toBe(true);

      const draft = await create();
      const draftImage = (await cars.addImage(draft.id, PNG, "Единственное")).images[0]!;
      const after = await cars.deleteImage(draft.id, draftImage.id);
      expect(after.images).toEqual([]);
      expect(await exists(keyOf(draftImage.path))).toBe(false);
    });
  });

  describe("setModel / removeModel", () => {
    it("загружает модель: путь /media/models/<id>/<uuid>.glb, материал из запроса", async () => {
      const car = await create();

      const after = await cars.setModel(car.id, glb(["Glass", "Body"]), "Body");

      expect(adminCarSchema.parse(after)).toEqual(after);
      expect(after.model).toEqual({
        path: expect.stringMatching(new RegExp(`^/media/models/${car.id}/[0-9a-f-]{36}\\.glb$`)),
        paintMaterial: "Body",
      });
      const object = await storage.get(keyOf(after.model!.path));
      object?.stream.destroy();
      expect(object?.contentType).toBe("model/gltf-binary");
    });

    it("заглушка placeholder-car.glb с материалом по умолчанию CarPaint", async () => {
      const car = await create();
      const file = readFileSync(
        join(import.meta.dirname, "../../public/assets/placeholder-car.glb"),
      );

      const after = await cars.setModel(car.id, file, "CarPaint");
      expect(after.model?.paintMaterial).toBe("CarPaint");
    });

    it("нет материала — PAINT_MATERIAL_NOT_FOUND со списком, до записи в MinIO", async () => {
      const car = await create();
      const put = spyPut();

      await expect(cars.setModel(car.id, glb(["Glass", "Body"]), "CarPaint")).rejects.toMatchObject(
        {
          code: "PAINT_MATERIAL_NOT_FOUND",
          status: 400,
          details: { field: "paintMaterial", materials: ["Glass", "Body"] },
        },
      );
      expect(put).not.toHaveBeenCalled();
      expect((await cars.getCar(car.id)).model).toBeNull();
    });

    it("невалидный GLB — INVALID_FILE", async () => {
      const car = await create();

      await expect(cars.setModel(car.id, PNG, "CarPaint")).rejects.toMatchObject({
        code: "INVALID_FILE",
        status: 400,
      });
    });

    it("нет автомобиля — NOT_FOUND, загруженный объект удаляется", async () => {
      const put = spyPut();

      await expect(cars.setModel(MISSING_ID, glb(["CarPaint"]), "CarPaint")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      const key = put.mock.calls[0]![0];
      keys.push(key);
      expect(key).toMatch(new RegExp(`^models/${MISSING_ID}/.+\\.glb$`));
      expect(await exists(key)).toBe(false);
    });

    it("замена удаляет старый объект; удаление — model: null, повтор без ошибки", async () => {
      const car = await create();
      const first = (await cars.setModel(car.id, glb(["CarPaint"]), "CarPaint")).model!;

      const second = (await cars.setModel(car.id, glb(["Paint"]), "Paint")).model!;
      expect(second).toMatchObject({ paintMaterial: "Paint" });
      expect(second.path).not.toBe(first.path);
      expect(await exists(keyOf(first.path))).toBe(false);
      expect(await exists(keyOf(second.path))).toBe(true);

      const removed = await cars.removeModel(car.id);
      expect(removed.model).toBeNull();
      expect(await exists(keyOf(second.path))).toBe(false);

      const remove = vi.spyOn(storage, "delete");
      expect(await cars.removeModel(car.id)).toEqual(removed);
      expect(remove).not.toHaveBeenCalled();

      await expect(cars.removeModel(MISSING_ID)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("deleteCar", () => {
    it("удаляет объекты фото и модели, загруженные через сервис", async () => {
      const car = await create();
      await cars.addImage(car.id, PNG, "a");
      await cars.addImage(car.id, WEBP, "b");
      const card = await cars.setModel(car.id, glb(["CarPaint"]), "CarPaint");
      const paths = [...card.images.map((image) => image.path), card.model!.path];

      await cars.deleteCar(car.id);

      for (const path of paths) {
        expect(await exists(keyOf(path))).toBe(false);
      }
    });
  });
});
