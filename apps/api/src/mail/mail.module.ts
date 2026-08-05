import { Global, Module } from "@nestjs/common";

import { MailAdapter } from "./mail.adapter.js";
import { MemoryMailAdapter } from "./memory-mail.adapter.js";

@Global()
@Module({
  providers: [
    MemoryMailAdapter,
    {
      provide: MailAdapter,
      useExisting: MemoryMailAdapter,
    },
  ],
  exports: [MailAdapter, MemoryMailAdapter],
})
export class MailModule {}
