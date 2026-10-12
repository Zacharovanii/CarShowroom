import { Global, Module } from "@nestjs/common";
import { MediaController } from "./media.controller.js";
import { StorageService } from "./storage.service.js";

// @Global(), как DatabaseModule: хранилище нужно и админке (загрузка),
// и раздаче /media/* — без импорта модуля в каждый из них.
@Global()
@Module({
  controllers: [MediaController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
