import { Controller, Get } from "@nestjs/common";
import { AllowAnonymous, Roles, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { apiErrorSchema, type ApiError } from "@carshowroom/contracts";
import { AppService } from "./app.service.js";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @AllowAnonymous()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Временная проверка: контракт виден в Nest и по типам, и в рантайме. */
  @AllowAnonymous()
  @Get("contracts-check")
  contractsCheck(): { valid: boolean; sample: ApiError } {
    const sample: ApiError = { error: { code: "NOT_FOUND", message: "нет такой страницы" } };
    return { valid: apiErrorSchema.safeParse(sample).success, sample };
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
