import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { IntegrationsModule } from "../integrations/integrations.module.js";
import { AttachmentsController } from "./attachments.controller.js";
import { AttachmentsService } from "./attachments.service.js";

@Module({
  controllers: [AttachmentsController],
  exports: [AttachmentsService],
  imports: [AuthModule, IntegrationsModule],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
