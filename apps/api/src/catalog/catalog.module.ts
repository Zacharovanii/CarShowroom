import { Module } from "@nestjs/common";
import { CarsController, CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";
import { CatalogRepository } from "./catalog.repository.js";

@Module({
  controllers: [CatalogController, CarsController],
  providers: [CatalogService, CatalogRepository],
})
export class CatalogModule {}
