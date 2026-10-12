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
  Query,
} from "@nestjs/common";
import { Roles } from "@thallesp/nestjs-better-auth";
import {
  adminCarsQuerySchema,
  createAdminCarSchema,
  updateAdminCarSchema,
  type AdminCar,
  type AdminCarOptions,
  type AdminCarsQuery,
  type AdminCarsResponse,
  type CreateAdminCar,
  type UpdateAdminCar,
} from "@carshowroom/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminCarsService } from "./admin-cars.service.js";

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
}
