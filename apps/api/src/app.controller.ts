import { Controller, Get } from "@nestjs/common";
import { AllowAnonymous, Roles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { AppService } from "./app.service.js";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @AllowAnonymous()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Временная проверка spike S2: без @AllowAnonymous — доступ только по сессии
   * и только точной роли manager. @Roles() сверяет user.role буквально, без
   * иерархии — admin сюда не проходит, если явно не добавить в список.
   */
  @Roles(["manager"])
  @Get("spike-manager-only")
  managerOnly(@Session() session: UserSession): { role: string | string[] } {
    return { role: session.user.role ?? "user" };
  }
}
