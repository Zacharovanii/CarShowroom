import { Module } from "@nestjs/common";
import { CarSlotsController, MyTestDrivesController } from "./test-drives.controller.js";
import { TestDrivesService } from "./test-drives.service.js";
import { TestDrivesRepository } from "./test-drives.repository.js";

@Module({
  controllers: [CarSlotsController, MyTestDrivesController],
  providers: [TestDrivesService, TestDrivesRepository],
})
export class TestDrivesModule {}
