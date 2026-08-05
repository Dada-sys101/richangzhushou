import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { AccountController } from "./account.controller.js";

@Module({
  controllers: [AccountController],
  imports: [AuthModule],
})
export class AccountModule {}
