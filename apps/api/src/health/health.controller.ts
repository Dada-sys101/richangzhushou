import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";

export interface HealthResponse {
  service: "daily-assistant-api";
  status: "ok";
}

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        code: "INTERNAL_ERROR",
        message: "数据库暂时不可用",
      });
    }
    return {
      service: "daily-assistant-api",
      status: "ok",
    };
  }
}
