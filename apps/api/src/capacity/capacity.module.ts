import { Global, Module } from "@nestjs/common";

import { CapacityService } from "./capacity.service.js";

@Global()
@Module({
  providers: [CapacityService],
  exports: [CapacityService],
})
export class CapacityModule {}
