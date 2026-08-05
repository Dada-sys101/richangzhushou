import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../generated/prisma/client.js";

const DEFAULT_DATABASE_URL =
  "mysql://daily_assistant:local-validation-only@127.0.0.1:3306/daily_assistant";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaMariaDb(
        process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
      ),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
