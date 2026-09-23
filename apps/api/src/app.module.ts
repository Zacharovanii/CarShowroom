import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "./config/config.module.js";
import { DatabaseModule } from "./db/db.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { TestDrivesModule } from "./test-drives/test-drives.module.js";
import { ManagerModule } from "./manager/manager.module.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    CatalogModule,
    TestDrivesModule,
    ManagerModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
