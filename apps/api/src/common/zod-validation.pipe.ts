import { Injectable, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";
import { AppError } from "./app-error.js";

/**
 * Валидация body/query/params схемой из contracts. Используется точечно
 * (`@Body(new ZodValidationPipe(createTestDriveSchema))`), а не глобально —
 * у разных схем разные места (body/query/params) и структура не совпадает
 * со стандартным Nest ValidationPipe (там классы с декораторами).
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppError("VALIDATION_FAILED", "Некорректные данные запроса", {
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
