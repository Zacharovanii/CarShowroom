import { Controller, Get } from "@nestjs/common";
import { apiErrorSchema, type ApiError } from "@carshowroom/contracts";
import { AppService } from "./app.service.js";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Временная проверка: контракт виден в Nest и по типам, и в рантайме. */
  @Get("contracts-check")
  contractsCheck(): { valid: boolean; sample: ApiError } {
    const sample: ApiError = { error: { code: "NOT_FOUND", message: "нет такой страницы" } };
    return { valid: apiErrorSchema.safeParse(sample).success, sample };
  }
}
