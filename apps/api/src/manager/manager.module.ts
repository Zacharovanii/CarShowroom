import { Module } from "@nestjs/common";
import { ManagerController } from "./manager.controller.js";
import { ManagerService } from "./manager.service.js";
import { ManagerRepository } from "./manager.repository.js";

@Module({
  controllers: [ManagerController],
  providers: [ManagerService, ManagerRepository],
})
export class ManagerModule {}
