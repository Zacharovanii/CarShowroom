import type { ZodError } from "zod";

/**
 * Сообщения по именам полей. Форм-библиотеки в проекте нет: контролируемые
 * инпуты плюс `safeParse` схемой из contracts (design-plan §8), а разбор
 * `ZodError` в «поле → сообщение» нужен всем формам проекта одинаково.
 */
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** Первая ошибка каждого поля: показывать сразу несколько по одному полю незачем. */
export function fieldErrors<K extends string>(error: ZodError): FieldErrors<K> {
  const errors: FieldErrors<K> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && errors[key as K] === undefined) {
      errors[key as K] = issue.message;
    }
  }

  return errors;
}
