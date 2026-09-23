import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { AllowAnonymous, Roles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  createTestDriveSchema,
  slotsQuerySchema,
  type CreateTestDrive,
  type MyTestDrives,
  type SlotsQuery,
  type SlotsResponse,
  type TestDrive,
} from "@carshowroom/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { TestDrivesService } from "./test-drives.service.js";

/**
 * Сетка слотов открыта гостю (UC-G4: время смотрят до входа), поэтому
 * @AllowAnonymous — глобальный AuthGuard Better Auth иначе потребует сессию.
 *
 * Путь растёт из /api/cars, как и каталог, но модуль другой — отдельный
 * контроллер с тем же корнем. Конфликта с @Get(":slug") каталога нет:
 * у маршрутов разное число сегментов.
 */
@Controller("cars")
export class CarSlotsController {
  constructor(private readonly testDrives: TestDrivesService) {}

  @AllowAnonymous()
  @Get(":slug/slots")
  getSlots(
    @Param("slug") slug: string,
    @Query(new ZodValidationPipe(slotsQuerySchema)) query: SlotsQuery,
  ): Promise<SlotsResponse> {
    return this.testDrives.getSlots(slug, query.date);
  }
}

/**
 * Записи клиента. @Roles(["user"]) сверяет user.role буквально, без
 * иерархии — и это ровно то, что нужно: сотрудники на тест-драйвы
 * не записываются (UC-M2), вкладки «Мои записи» у них нет.
 */
@Roles(["user"])
@Controller("me/test-drives")
export class MyTestDrivesController {
  constructor(private readonly testDrives: TestDrivesService) {}

  @Get()
  getMine(@Session() session: UserSession): Promise<MyTestDrives> {
    return this.testDrives.getMyTestDrives(session.user.id);
  }

  @Post()
  create(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(createTestDriveSchema)) body: CreateTestDrive,
  ): Promise<TestDrive> {
    return this.testDrives.create(session.user.id, body);
  }

  @Post(":id/cancel")
  cancel(
    @Session() session: UserSession,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<TestDrive> {
    return this.testDrives.cancel(session.user.id, id);
  }
}
