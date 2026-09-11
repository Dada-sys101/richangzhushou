import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module.js";
import { PrismaService } from "../prisma/prisma.service.js";

describe("health route", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("serves the versioned, non-sensitive health response", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]) })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("/api/v1");
    await app.init();

    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200);

    expect(response.body).toEqual({
      service: "daily-assistant-api",
      status: "ok",
    });
  });
});
