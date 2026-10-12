import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Roles } from "@thallesp/nestjs-better-auth";
import {
  adminCarsQuerySchema,
  carImageAltSchema,
  carImagesOrderSchema,
  carModelFieldsSchema,
  createAdminCarSchema,
  updateAdminCarSchema,
  type AdminCar,
  type AdminCarOptions,
  type AdminCarsQuery,
  type AdminCarsResponse,
  type CarImageAlt,
  type CarImagesOrder,
  type CarModelFields,
  type CreateAdminCar,
  type UpdateAdminCar,
} from "@carshowroom/contracts";
import { AppError } from "../common/app-error.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminCarsService } from "./admin-cars.service.js";
import { IMAGE_MAX_BYTES, MODEL_MAX_BYTES } from "./file-checks.js";

// Без storage/dest multer держит файл в памяти (file.buffer) — сигнатуру
// и GLB надо проверить до записи в MinIO. Тип файла структурный: ради
// одного поля @types/multer не тянем.
type UploadedFileLike = { buffer: Buffer };

/** Поле `file` необязательно для multer — без него файла просто нет. */
function requireFile(file: UploadedFileLike | undefined): Buffer {
  if (!file) {
    throw new AppError("VALIDATION_FAILED", "Прикрепите файл", { field: "file" });
  }
  return file.buffer;
}

// Каталог из админки (D26) — только для админа.
@Roles(["admin"])
@Controller("admin/cars")
export class AdminCarsController {
  constructor(private readonly cars: AdminCarsService) {}

  @Get()
  getCars(
    @Query(new ZodValidationPipe(adminCarsQuerySchema)) query: AdminCarsQuery,
  ): Promise<AdminCarsResponse> {
    return this.cars.getCars(query);
  }

  // Раньше `:id`: иначе "options" ушло бы в ParseIntPipe и вернулось 400.
  @Get("options")
  getOptions(): Promise<AdminCarOptions> {
    return this.cars.getOptions();
  }

  @Get(":id")
  getCar(@Param("id", ParseIntPipe) id: number): Promise<AdminCar> {
    return this.cars.getCar(id);
  }

  @Post()
  createCar(
    @Body(new ZodValidationPipe(createAdminCarSchema)) body: CreateAdminCar,
  ): Promise<AdminCar> {
    return this.cars.createCar(body);
  }

  @Patch(":id")
  updateCar(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateAdminCarSchema)) body: UpdateAdminCar,
  ): Promise<AdminCar> {
    return this.cars.updateCar(id, body);
  }

  // POST по умолчанию 201, а публикация ничего не создаёт
  @Post(":id/publish")
  @HttpCode(200)
  publishCar(@Param("id", ParseIntPipe) id: number): Promise<AdminCar> {
    return this.cars.publishCar(id);
  }

  @Post(":id/unpublish")
  @HttpCode(200)
  unpublishCar(@Param("id", ParseIntPipe) id: number): Promise<AdminCar> {
    return this.cars.unpublishCar(id);
  }

  @Delete(":id")
  @HttpCode(204)
  deleteCar(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.cars.deleteCar(id);
  }

  // Фото и модель (UC-A5, UC-A6). Лишнее поле-файл multer отклоняет
  // (400 VALIDATION_FAILED), файл больше лимита — 413 FILE_TOO_LARGE.

  @Post(":id/images")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: IMAGE_MAX_BYTES } }))
  addImage(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body(new ZodValidationPipe(carImageAltSchema)) body: CarImageAlt,
  ): Promise<AdminCar> {
    return this.cars.addImage(id, requireFile(file), body.alt);
  }

  // Раньше маршрутов с `:imageId`, как "options" раньше `:id`: сейчас
  // методы не пересекаются (PUT здесь, PATCH/DELETE там), но PUT
  // `:imageId` отправил бы "order" в ParseIntPipe и вернул 400.
  @Put(":id/images/order")
  reorderImages(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(carImagesOrderSchema)) body: CarImagesOrder,
  ): Promise<AdminCar> {
    return this.cars.reorderImages(id, body.imageIds);
  }

  @Put(":id/images/:imageId/file")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: IMAGE_MAX_BYTES } }))
  replaceImageFile(
    @Param("id", ParseIntPipe) id: number,
    @Param("imageId", ParseIntPipe) imageId: number,
    @UploadedFile() file: UploadedFileLike | undefined,
  ): Promise<AdminCar> {
    return this.cars.replaceImageFile(id, imageId, requireFile(file));
  }

  @Patch(":id/images/:imageId")
  updateImageAlt(
    @Param("id", ParseIntPipe) id: number,
    @Param("imageId", ParseIntPipe) imageId: number,
    @Body(new ZodValidationPipe(carImageAltSchema)) body: CarImageAlt,
  ): Promise<AdminCar> {
    return this.cars.updateImageAlt(id, imageId, body.alt);
  }

  // DELETE у Nest по умолчанию 200 — ответ карточка, @HttpCode не нужен
  @Delete(":id/images/:imageId")
  deleteImage(
    @Param("id", ParseIntPipe) id: number,
    @Param("imageId", ParseIntPipe) imageId: number,
  ): Promise<AdminCar> {
    return this.cars.deleteImage(id, imageId);
  }

  @Put(":id/model")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MODEL_MAX_BYTES } }))
  setModel(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body(new ZodValidationPipe(carModelFieldsSchema)) body: CarModelFields,
  ): Promise<AdminCar> {
    return this.cars.setModel(id, requireFile(file), body.paintMaterial);
  }

  @Delete(":id/model")
  removeModel(@Param("id", ParseIntPipe) id: number): Promise<AdminCar> {
    return this.cars.removeModel(id);
  }
}
