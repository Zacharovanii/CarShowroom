import {
  changePasswordFormSchema,
  signInSchema,
  signUpFormSchema,
  updateProfileSchema,
} from "@carshowroom/contracts";

// Схемы форм входа/регистрации/профиля (UC-G5, UC-G6, UC-U2). Проверяются
// правила, которые иначе всплыли бы только CHECK-ом в Postgres, и совпадение
// паролей — его на уровне схемы легко потерять при правке.

describe("Схемы форм авторизации", () => {
  const validSignUp = {
    name: "Иван Клиент",
    email: "ivan@example.com",
    phone: "+79991234567",
    password: "SuperSecret123!",
    confirmPassword: "SuperSecret123!",
    consent: true,
  };

  it("принимает корректную регистрацию и нормализует email и имя", () => {
    const parsed = signUpFormSchema.parse({
      ...validSignUp,
      email: "  Ivan@Example.COM ",
      name: "  Иван Клиент  ",
    });

    expect(parsed.email).toBe("ivan@example.com");
    expect(parsed.name).toBe("Иван Клиент");
  });

  it("требует совпадения паролей — ошибка у поля подтверждения", () => {
    const result = signUpFormSchema.safeParse({ ...validSignUp, confirmPassword: "другой" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("без согласия на обработку данных не пропускает — ошибка у галочки", () => {
    const result = signUpFormSchema.safeParse({ ...validSignUp, consent: false });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["consent"]);
  });

  it.each(["88005553535", "+7999123456", "+7 999 123 45 67", ""])(
    "отклоняет телефон %s — тот же формат, что в users_phone_ck",
    (phone) => {
      expect(signUpFormSchema.safeParse({ ...validSignUp, phone }).success).toBe(false);
    },
  );

  it("отклоняет пароль короче 8 символов (UC-G5)", () => {
    const short = { ...validSignUp, password: "Short1!", confirmPassword: "Short1!" };
    expect(signUpFormSchema.safeParse(short).success).toBe(false);
  });

  it("отклоняет имя длиннее 100 символов — предел users_name_ck", () => {
    const long = { ...validSignUp, name: "и".repeat(101) };
    expect(signUpFormSchema.safeParse(long).success).toBe(false);
  });

  it("на входе проверяет только заполненность пароля (UC-G6)", () => {
    expect(signInSchema.safeParse({ email: "ivan@example.com", password: "x" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "ivan@example.com", password: "" }).success).toBe(false);
  });

  it("смена пароля требует совпадения нового и подтверждения", () => {
    const form = {
      currentPassword: "SuperSecret123!",
      newPassword: "BrandNewPass456!",
      confirmPassword: "BrandNewPass456!",
    };

    expect(changePasswordFormSchema.safeParse(form).success).toBe(true);
    expect(changePasswordFormSchema.safeParse({ ...form, confirmPassword: "иной" }).success).toBe(
      false,
    );
  });

  it("в контактных данных email не меняется — его в схеме нет (UC-U2)", () => {
    const parsed = updateProfileSchema.parse({
      name: "Пётр",
      phone: "+79990000042",
      email: "hacker@example.com",
    });

    expect(parsed).toEqual({ name: "Пётр", phone: "+79990000042" });
  });
});
