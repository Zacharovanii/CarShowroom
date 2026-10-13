import { z } from "zod";
import { emailSchema, passwordSchema, personNameSchema, phoneSchema } from "./common.js";

/**
 * Регистрация, вход и профиль. Запросы уходят напрямую в Better Auth
 * (/api/auth/*), своих контроллеров у них нет, но правила полей — часть
 * контракта: UC-G5 требует, чтобы клиент проверял теми же схемами.
 *
 * Пара «схема запроса + схема формы» везде, где у формы есть поле
 * подтверждения: на провод confirm не уходит, это правило самой формы.
 */

// ---------------------------------------------------------------------
// POST /api/auth/sign-up/email
// ---------------------------------------------------------------------

export const signUpSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export type SignUp = z.infer<typeof signUpSchema>;

/** Пароли совпадают — проверка на уровне схемы, ошибка у поля подтверждения. */
// confirmPassword и consent — правила формы, на провод они не уходят
export const signUpFormSchema = signUpSchema
  .extend({
    confirmPassword: z.string(),
    consent: z.literal(true, { error: "нужно согласие на обработку персональных данных" }),
  })
  .refine((form) => form.password === form.confirmPassword, {
    message: "пароли не совпадают",
    path: ["confirmPassword"],
  });

export type SignUpForm = z.infer<typeof signUpFormSchema>;

// ---------------------------------------------------------------------
// POST /api/auth/sign-in/email
// ---------------------------------------------------------------------

// UC-G6: при неверных данных сообщение общее, поэтому у формы входа
// проверяется только заполненность — не формат пароля.
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "введите пароль"),
});

export type SignIn = z.infer<typeof signInSchema>;

// ---------------------------------------------------------------------
// POST /api/auth/change-password
// ---------------------------------------------------------------------

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "введите текущий пароль"),
  newPassword: passwordSchema,
});

export type ChangePassword = z.infer<typeof changePasswordSchema>;

export const changePasswordFormSchema = changePasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((form) => form.newPassword === form.confirmPassword, {
    message: "пароли не совпадают",
    path: ["confirmPassword"],
  });

export type ChangePasswordForm = z.infer<typeof changePasswordFormSchema>;

// ---------------------------------------------------------------------
// POST /api/auth/send-verification-email
// POST /api/auth/request-password-reset
// ---------------------------------------------------------------------

/**
 * Повторное письмо подтверждения и запрос сброса пароля — одно поле email.
 * Ответ всегда одинаковый, есть такой адрес или нет: по нему нельзя
 * проверить, зарегистрирован ли человек.
 */
export const sendVerificationEmailSchema = z.object({
  email: emailSchema,
});

export type SendVerificationEmail = z.infer<typeof sendVerificationEmailSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPassword = z.infer<typeof forgotPasswordSchema>;

// ---------------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------------

/** token — из ссылки в письме, его проверяет только бэкенд. */
export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
  token: z.string().min(1),
});

export type ResetPassword = z.infer<typeof resetPasswordSchema>;

// token в форму не вводится — он берётся из адреса страницы
export const resetPasswordFormSchema = resetPasswordSchema
  .omit({ token: true })
  .extend({ confirmPassword: z.string() })
  .refine((form) => form.newPassword === form.confirmPassword, {
    message: "пароли не совпадают",
    path: ["confirmPassword"],
  });

export type ResetPasswordForm = z.infer<typeof resetPasswordFormSchema>;

// ---------------------------------------------------------------------
// POST /api/auth/update-user
// ---------------------------------------------------------------------

/** UC-U2: меняются только имя и телефон, email — только чтение. */
export const updateProfileSchema = z.object({
  name: personNameSchema,
  phone: phoneSchema,
});

export type UpdateProfile = z.infer<typeof updateProfileSchema>;
