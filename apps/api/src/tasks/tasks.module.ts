import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { TasksController } from "./tasks.controller.js";
import { TasksService } from "./tasks.service.js";

@Module({
  controllers: [TasksController],
  imports: [AuthModule],
  providers: [TasksService],
})
export class TasksModule {}
