import { Controller, Get, Param, Query } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import {
  carsQuerySchema,
  type CarDetails,
  type CarsQuery,
  type CarsResponse,
  type CatalogFilters,
} from "@carshowroom/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { CatalogService } from "./catalog.service.js";

// Весь каталог открыт гостю (раздел 4 design-plan.md), а AuthGuard
// Better Auth зарегистрирован глобально — отсюда @AllowAnonymous().

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @AllowAnonymous()
  @Get("filters")
  getFilters(): Promise<CatalogFilters> {
    return this.catalogService.getFilters();
  }
}

// /api/catalog/filters и /api/cars растут из разных корней пути, поэтому
// у каталога два контроллера с общим сервисом, а не один с "catalog".
@Controller("cars")
export class CarsController {
  constructor(private readonly catalogService: CatalogService) {}

  @AllowAnonymous()
  @Get()
  getCars(@Query(new ZodValidationPipe(carsQuerySchema)) query: CarsQuery): Promise<CarsResponse> {
    return this.catalogService.getCars(query);
  }

  @AllowAnonymous()
  @Get(":slug")
  getCarBySlug(@Param("slug") slug: string): Promise<CarDetails> {
    return this.catalogService.getCarBySlug(slug);
  }
}
