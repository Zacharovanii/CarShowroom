import { Module, type OnModuleDestroy } from "@nestjs/common";
import { AuthModule as BetterAuthModule } from "@thallesp/nestjs-better-auth";
import { auth, authPool } from "./auth.js";

// Регистрирует глобальный AuthGuard (@thallesp/nestjs-better-auth) и контроллеры
// Better Auth под /api/auth/*. Закрытие pg Pool — здесь же (D7.1): postgres.js
// закрывается отдельно в DatabaseModule, когда тот появится.
@Module({
  imports: [BetterAuthModule.forRoot({ auth })],
})
export class AuthModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await authPool.end();
  }
}
