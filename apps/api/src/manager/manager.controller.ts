import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from "@nestjs/common";
import { Roles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  closeTestDriveSchema,
  managerTestDrivesQuerySchema,
  type CloseTestDrive,
  type ManagerTestDrive,
  type ManagerTestDrives,
  type ManagerTestDrivesQuery,
} from "@carshowroom/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ManagerService } from "./manager.service.js";

/**
 * Экран менеджера. @Roles() сверяет user.role буквально, иерархии ролей
 * у него нет, поэтому «права накопительные» (use-cases.md, «Роли»)
 * записываются списком: admin может всё, что manager.
 *
 * Персональные данные клиента (телефон, email) отдаются только отсюда
 * и из админского списка — в клиентских эндпоинтах их нет.
 */
@Roles(["manager", "admin"])
@Controller("manager/test-drives")
export class ManagerController {
  constructor(private readonly manager: ManagerService) {}

  @Get()
  getDay(
    @Query(new ZodValidationPipe(managerTestDrivesQuerySchema)) query: ManagerTestDrivesQuery,
  ): Promise<ManagerTestDrives> {
    return this.manager.getDay(query);
  }

  @Patch(":id")
  close(
    @Session() session: UserSession,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(closeTestDriveSchema)) body: CloseTestDrive,
  ): Promise<ManagerTestDrive> {
    return this.manager.close(session.user.id, id, body);
  }
}
