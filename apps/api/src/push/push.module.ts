import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { PushController } from "./push.controller.js";
import { PushService } from "./push.service.js";
import { PushSecretCipher } from "./push-secret-cipher.js";

@Module({
  controllers: [PushController],
  imports: [AuthModule],
  providers: [PushSecretCipher, PushService],
  exports: [PushSecretCipher],
})
export class PushModule {}
