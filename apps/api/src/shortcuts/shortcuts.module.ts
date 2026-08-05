import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DraftsModule } from "../drafts/drafts.module.js";
import { FinanceModule } from "../finance/finance.module.js";
import { DeviceCredentialGuard } from "./device-credential.guard.js";
import { ShortcutsController } from "./shortcuts.controller.js";
import { ShortcutsService } from "./shortcuts.service.js";

@Module({
  controllers: [ShortcutsController],
  exports: [ShortcutsService],
  imports: [AuthModule, DraftsModule, FinanceModule],
  providers: [DeviceCredentialGuard, ShortcutsService],
})
export class ShortcutsModule {}
