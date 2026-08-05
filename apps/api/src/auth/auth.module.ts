import { Module } from "@nestjs/common";

import { AccessTokenGuard } from "./access-token.guard.js";
import { AdminGuard } from "./admin.guard.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { CookieService } from "./cookie.service.js";
import { RefreshTokenGuard } from "./refresh-token.guard.js";
import { UserOnlyGuard } from "./user-only.guard.js";

@Module({
  controllers: [AuthController],
  providers: [
    AccessTokenGuard,
    AdminGuard,
    AuthService,
    CookieService,
    RefreshTokenGuard,
    UserOnlyGuard,
  ],
  exports: [
    AccessTokenGuard,
    AdminGuard,
    AuthService,
    CookieService,
    RefreshTokenGuard,
    UserOnlyGuard,
  ],
})
export class AuthModule {}
