import { z } from "zod";

/**
 * Примитивы контракта, общие для нескольких разделов. Живут отдельно,
 * чтобы одно правило («телефон — формат РФ») не расходилось между
 * записью на тест-драйв и созданием сотрудника.
 */

/** Часовой пояс салона (TD-3) — один на весь проект, второго не будет. */
export const SALON_TIME_ZONE = "Europe/Moscow";

/** День в сетке слотов и в фильтрах — календарная дата пояса салона, без времени. */
export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "дата в формате YYYY-MM-DD");

/** Телефон в формате РФ — тот же CHECK, что и в схеме БД. */
export const phoneSchema = z.string().regex(/^\+7\d{10}$/, "телефон в формате +7XXXXXXXXXX");

/** Момент времени — ISO-строка со смещением (даты на проводе — строки). */
export const instantSchema = z.iso.datetime({ offset: true });

/** Время начала в поясе салона, «10:00» — подпись в сетке и в списке записей. */
export const timeLabelSchema = z.string().regex(/^\d{2}:\d{2}$/);

/** Имя человека — тот же диапазон, что и CHECK users_name_ck. */
export const personNameSchema = z.string().trim().min(1, "укажите имя").max(100);

/**
 * Email. `toLowerCase` — не украшение: в БД CHECK требует нижний регистр
 * (users_email_ck), а уникальность email считается по точному значению.
 */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("некорректный email"));

/** Пароль. Нижняя граница — из UC-G5, верхняя — предел bcrypt-совместимых хешей. */
export const passwordSchema = z
  .string()
  .min(8, "пароль не короче 8 символов")
  .max(128, "пароль не длиннее 128 символов");
