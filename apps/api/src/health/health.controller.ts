import { Controller, Get } from "@nestjs/common";

export interface HealthResponse {
  service: "daily-assistant-api";
  status: "ok";
}

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      service: "daily-assistant-api",
      status: "ok",
    };
  }
}
