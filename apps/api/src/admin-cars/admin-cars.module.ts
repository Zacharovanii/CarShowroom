import { Module } from "@nestjs/common";
import { AdminCarsController } from "./admin-cars.controller.js";
import { AdminCarsService } from "./admin-cars.service.js";
import { AdminCarsRepository } from "./admin-cars.repository.js";

@Module({
  controllers: [AdminCarsController],
  providers: [AdminCarsService, AdminCarsRepository],
})
export class AdminCarsModule {}
