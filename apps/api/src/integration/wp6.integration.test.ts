import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import "reflect-metadata";
import { hash } from "argon2";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppModule } from "../app.module.js";
import { AllExceptionsFilter } from "../common/all-exceptions.filter.js";
import { RateLimiterService } from "../common/rate-limiter.service.js";
import { requestIdMiddleware } from "../common/request-id.middleware.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { MemoryMailAdapter } from "../mail/memory-mail.adapter.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const TEST_PASSWORD = "UserPassword123!";
const ADMIN_PASSWORD = "AdminPassword123!";

const describeWithDb = testDatabaseUrl ? describe : describe.skip;

describeWithDb("WP6 trips, trip items, packing items, and expense summary", () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let userSequence = 0;

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      return;
    }
    process.env.DATABASE_URL = testDatabaseUrl;
    prisma = new PrismaClient({
      adapter: new PrismaMariaDb(testDatabaseUrl),
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(async () => {
    if (!prisma) {
      return;
    }
    userSequence += 1;
    await resetDatabase();
    await seedAdmin();
    app.get(RateLimiterService).reset();
    app.get(MemoryMailAdapter).reset();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it("BR-TRIP-001 + trip CRUD: rejects end before start, supports idempotency, version conflicts, and soft delete/restore", async () => {
    const token = await loginNewUser();

    const invalid = await createTrip(token, {
      destination: "上海",
      endDate: "2026-08-09",
      startDate: "2026-08-10",
      title: "时间倒置",
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("VALIDATION_ERROR");

    const body = {
      budgetAmount: "1200.00",
      clientMutationId: "trip-mutation-key-0001",
      destination: "杭州",
      endDate: "2026-08-12",
      startDate: "2026-08-10",
      title: "杭州三日",
    };
    const first = await createTrip(token, body);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      budgetAmount: "1200.00",
      destination: "杭州",
      endDate: "2026-08-12",
      startDate: "2026-08-10",
      title: "杭州三日",
    });
    const tripId = first.body.id as string;

    const replay = await createTrip(token, body);
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(tripId);

    const conflict = await createTrip(token, { ...body, title: "不同内容" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("IDEMPOTENCY_CONFLICT");

    const stale = await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "过期版本", version: 99 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("VERSION_CONFLICT");

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ endDate: "2026-08-13", title: "杭州四日", version: 1 });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe("杭州四日");
    expect(updated.body.endDate).toBe("2026-08-13");
    expect(updated.body.version).toBe(2);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.trip.id).toBe(tripId);
    expect(detail.body.items).toEqual([]);
    expect(detail.body.packingItems).toEqual([]);
    expect(detail.body.linkedTransactions).toEqual([]);

    await request(app.getHttpServer())
      .delete(`/api/v1/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
    const active = await request(app.getHttpServer())
      .get("/api/v1/trips")
      .set("Authorization", `Bearer ${token}`);
    expect(active.body.items).toHaveLength(0);
    const withDeleted = await request(app.getHttpServer())
      .get("/api/v1/trips?includeDeleted=true")
      .set("Authorization", `Bearer ${token}`);
    expect(withDeleted.body.items).toHaveLength(1);

    const restored = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/restore`)
      .set("Authorization", `Bearer ${token}`);
    expect(restored.status).toBe(200);
    expect(restored.body.deletedAt).toBeNull();
  });

  it("BR-TRIP-002: out-of-range trip items are rejected until confirmed and then warn", async () => {
    const token = await loginNewUser();
    const trip = await createTrip(token, {
      destination: "杭州",
      endDate: "2026-08-12",
      startDate: "2026-08-10",
      title: "杭州三日",
    });
    const tripId = trip.body.id as string;

    const inside = await createTripItem(token, tripId, {
      endsAt: "2026-08-10T04:00:00.000Z",
      startsAt: "2026-08-10T01:00:00.000Z",
      type: "ACTIVITY",
    });
    expect(inside.status).toBe(201);
    expect(inside.body.outOfRangeWarning).toBeUndefined();
    expect(inside.body.tripItem.position).toBe(0);

    const outOfRange = await createTripItem(token, tripId, {
      endsAt: "2026-08-10T04:00:00.000Z",
      startsAt: "2026-08-09T01:00:00.000Z",
      type: "TRANSPORT",
    });
    expect(outOfRange.status).toBe(400);
    expect(outOfRange.body.code).toBe("VALIDATION_ERROR");
    expect(outOfRange.body.message).toContain("超出");

    const confirmed = await createTripItem(token, tripId, {
      confirmOutOfRange: true,
      endsAt: "2026-08-10T04:00:00.000Z",
      startsAt: "2026-08-09T01:00:00.000Z",
      type: "TRANSPORT",
    });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.outOfRangeWarning).toMatchObject({
      code: "TRIP_ITEM_OUT_OF_RANGE",
    });
    const itemId = confirmed.body.tripItem.id as string;

    const movedOut = await request(app.getHttpServer())
      .patch(`/api/v1/trip-items/${itemId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        confirmOutOfRange: false,
        endsAt: "2026-08-14T04:00:00.000Z",
        startsAt: "2026-08-14T01:00:00.000Z",
        version: 1,
      });
    expect(movedOut.status).toBe(400);
    expect(movedOut.body.code).toBe("VALIDATION_ERROR");

    const movedOutConfirmed = await request(app.getHttpServer())
      .patch(`/api/v1/trip-items/${itemId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        confirmOutOfRange: true,
        endsAt: "2026-08-14T04:00:00.000Z",
        startsAt: "2026-08-14T01:00:00.000Z",
        version: 1,
      });
    expect(movedOutConfirmed.status).toBe(200);
    expect(movedOutConfirmed.body.outOfRangeWarning).toMatchObject({
      code: "TRIP_ITEM_OUT_OF_RANGE",
    });

    const inverted = await createTripItem(token, tripId, {
      endsAt: "2026-08-10T01:00:00.000Z",
      startsAt: "2026-08-10T04:00:00.000Z",
      type: "OTHER",
    });
    expect(inverted.status).toBe(400);
    expect(inverted.body.code).toBe("VALIDATION_ERROR");
  });

  it("packing items support position ordering, toggle, idempotency, and soft delete/restore", async () => {
    const token = await loginNewUser();
    const trip = await createTrip(token, {
      destination: "杭州",
      endDate: "2026-08-12",
      startDate: "2026-08-10",
      title: "杭州三日",
    });
    const tripId = trip.body.id as string;

    const passport = await createPackingItem(token, tripId, {
      text: "护照",
    });
    expect(passport.status).toBe(201);
    expect(passport.body.position).toBe(0);
    const camera = await createPackingItem(token, tripId, {
      text: "相机",
    });
    expect(camera.body.position).toBe(1);

    const idempotentBody = {
      clientMutationId: "packing-mutation-key-0001",
      text: "充电宝",
    };
    const first = await createPackingItem(token, tripId, idempotentBody);
    expect(first.status).toBe(201);
    const replay = await createPackingItem(token, tripId, idempotentBody);
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(first.body.id);

    const toggled = await request(app.getHttpServer())
      .patch(`/api/v1/packing-items/${passport.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ checked: true, version: 1 });
    expect(toggled.status).toBe(200);
    expect(toggled.body.checked).toBe(true);

    const stale = await request(app.getHttpServer())
      .patch(`/api/v1/packing-items/${passport.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ checked: false, version: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("VERSION_CONFLICT");

    await request(app.getHttpServer())
      .delete(`/api/v1/packing-items/${camera.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);
    const afterDelete = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(afterDelete.body.packingItems.map((item: { text: string }) => item.text)).toEqual([
      "护照",
      "充电宝",
    ]);

    const restored = await request(app.getHttpServer())
      .post(`/api/v1/packing-items/${camera.body.id}/restore`)
      .set("Authorization", `Bearer ${token}`);
    expect(restored.status).toBe(200);
    expect(restored.body.text).toBe("相机");
  });

  it("QA-TRIP-001: trip expense summary aggregates confirmed linked transactions only", async () => {
    const token = await loginNewUser();
    const trip = await createTrip(token, {
      budgetAmount: "200.00",
      destination: "杭州",
      endDate: "2026-08-12",
      startDate: "2026-08-10",
      title: "杭州三日",
    });
    const tripId = trip.body.id as string;

    await createTransaction(token, {
      amount: "100.00",
      tripId,
      type: "EXPENSE",
    });
    await createTransaction(token, {
      amount: "20.00",
      isUnlinkedRefund: true,
      tripId,
      type: "REFUND",
    });
    await createTransaction(token, {
      amount: "50.00",
      tripId,
      type: "INCOME",
    });
    const userId = await userIdOf(token);
    await prisma.transaction.create({
      data: {
        amount: "999.00",
        occurredAt: new Date("2026-08-11T01:00:00.000Z"),
        status: "DRAFT",
        tripId,
        type: "EXPENSE",
        userId,
      },
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.expense).toEqual({
      actualExpense: "80.00",
      budgetAmount: "200.00",
      budgetProgress: "0.40",
    });
    expect(detail.body.linkedTransactions).toHaveLength(3);

    const otherToken = await loginNewUser();
    const crossLink = await createTransaction(otherToken, {
      amount: "10.00",
      tripId,
      type: "EXPENSE",
    });
    expect(crossLink.status).toBe(404);
    expect(crossLink.body.code).toBe("RESOURCE_NOT_FOUND");

    const ownTrip = await createTrip(otherToken, {
      destination: "苏州",
      endDate: "2026-08-20",
      startDate: "2026-08-18",
      title: "苏州一日",
    });
    const unlinked = await createTransaction(token, {
      amount: "15.00",
      type: "EXPENSE",
    });
    const linkedUpdate = await request(app.getHttpServer())
      .patch(`/api/v1/transactions/${unlinked.body.transaction.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ tripId, version: 1 });
    expect(linkedUpdate.status).toBe(200);
    expect(linkedUpdate.body.transaction.tripId).toBe(tripId);

    const crossUpdate = await request(app.getHttpServer())
      .patch(`/api/v1/transactions/${unlinked.body.transaction.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ tripId: ownTrip.body.id, version: 2 });
    expect(crossUpdate.status).toBe(404);
    expect(crossUpdate.body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("trip detail returns calendar events inside the trip date range", async () => {
    const token = await loginNewUser();
    const trip = await createTrip(token, {
      destination: "杭州",
      endDate: "2026-08-12",
      startDate: "2026-08-10",
      title: "杭州三日",
    });
    const tripId = trip.body.id as string;

    await request(app.getHttpServer())
      .post("/api/v1/calendar-events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        endsAt: "2026-08-11T04:00:00.000Z",
        startsAt: "2026-08-11T01:00:00.000Z",
        title: "行程内日程",
      })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/calendar-events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        endsAt: "2026-08-15T04:00:00.000Z",
        startsAt: "2026-08-15T01:00:00.000Z",
        title: "行程外日程",
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.body.calendarEvents).toHaveLength(1);
    expect(detail.body.calendarEvents[0].title).toBe("行程内日程");
  });

  it("QA-SEC-001/002 extension: cross-user trip access is 404 and admins get 403", async () => {
    const aToken = await loginNewUser();
    const bToken = await loginNewUser();

    const bTrip = await createTrip(bToken, {
      destination: "杭州",
      endDate: "2026-08-12",
      startDate: "2026-08-10",
      title: "B 的行程",
    });
    const tripId = bTrip.body.id as string;
    const bItem = await createTripItem(bToken, tripId, {
      endsAt: "2026-08-10T04:00:00.000Z",
      startsAt: "2026-08-10T01:00:00.000Z",
      type: "ACTIVITY",
    });
    const itemId = bItem.body.tripItem.id as string;
    const bPacking = await createPackingItem(bToken, tripId, {
      text: "B 的行李",
    });
    const packingId = bPacking.body.id as string;

    const checks: Array<{
      body?: unknown;
      method: "DELETE" | "GET" | "PATCH" | "POST";
      path: string;
    }> = [
      { method: "GET", path: `/api/v1/trips/${tripId}` },
      {
        method: "PATCH",
        path: `/api/v1/trips/${tripId}`,
        body: { destination: "越权", endDate: "2026-08-12", startDate: "2026-08-10", title: "越权", version: 1 },
      },
      { method: "DELETE", path: `/api/v1/trips/${tripId}` },
      { method: "POST", path: `/api/v1/trips/${tripId}/restore` },
      {
        method: "POST",
        path: `/api/v1/trips/${tripId}/items`,
        body: { endsAt: "2026-08-10T04:00:00.000Z", startsAt: "2026-08-10T01:00:00.000Z", type: "ACTIVITY" },
      },
      { method: "GET", path: `/api/v1/trip-items/${itemId}` },
      { method: "PATCH", path: `/api/v1/trip-items/${itemId}`, body: { version: 1 } },
      { method: "DELETE", path: `/api/v1/trip-items/${itemId}` },
      { method: "POST", path: `/api/v1/trip-items/${itemId}/restore` },
      {
        method: "POST",
        path: `/api/v1/trips/${tripId}/packing-items`,
        body: { text: "越权行李" },
      },
      { method: "GET", path: `/api/v1/packing-items/${packingId}` },
      { method: "PATCH", path: `/api/v1/packing-items/${packingId}`, body: { version: 1 } },
      { method: "DELETE", path: `/api/v1/packing-items/${packingId}` },
      { method: "POST", path: `/api/v1/packing-items/${packingId}/restore` },
    ];
    for (const { body, method, path } of checks) {
      const response = await sendWithAuth(method, path, aToken, {
        ...(body as Record<string, unknown>),
      });
      expect(response.status).toBe(404);
    }

    const admin = await login("admin@example.com", ADMIN_PASSWORD);
    const adminList = await request(app.getHttpServer())
      .get("/api/v1/trips")
      .set("Authorization", `Bearer ${admin.accessToken}`);
    expect(adminList.status).toBe(403);
    const adminCreate = await request(app.getHttpServer())
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        destination: "管理员行程",
        endDate: "2026-08-12",
        startDate: "2026-08-10",
        title: "管理员行程",
      });
    expect(adminCreate.status).toBe(403);
  });

  it("concurrent idempotent trip creation creates a single record", async () => {
    const token = await loginNewUser();
    const body = {
      clientMutationId: "trip-concurrent-key-0001",
      destination: "并发",
      endDate: "2026-08-12",
      startDate: "2026-08-10",
      title: "并发行程",
    };
    const [first, second] = await Promise.all([
      createTrip(token, body),
      createTrip(token, body),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.id).toBe(second.body.id);
    const count = await prisma.trip.count({
      where: { clientMutationId: body.clientMutationId },
    });
    expect(count).toBe(1);
  });

  async function resetDatabase(): Promise<void> {
    await prisma.packingItem.deleteMany();
    await prisma.tripItem.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.reminder.deleteMany();
    await prisma.task.deleteMany();
    await prisma.calendarEvent.deleteMany();
    await prisma.draftRecord.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.deviceCredential.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.financialAccount.deleteMany();
    await prisma.category.deleteMany();
    await prisma.inviteRedemption.deleteMany();
    await prisma.recoveryCode.deleteMany();
    await prisma.session.deleteMany();
    await prisma.adminAudit.deleteMany();
    await prisma.inviteCode.deleteMany();
    await prisma.user.deleteMany();
    await prisma.systemSetting.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        inviteRequired: true,
        maxActiveUsers: 20,
        registrationEnabled: true,
      },
      update: {
        inviteRequired: true,
        maxActiveUsers: 20,
        registrationEnabled: true,
      },
    });
  }

  async function seedAdmin(): Promise<void> {
    const passwordHash = await hash(ADMIN_PASSWORD, { type: 2 });
    await prisma.user.create({
      data: {
        displayName: "Admin",
        email: "admin@example.com",
        normalizedEmail: "admin@example.com",
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
  }

  async function loginNewUser(): Promise<string> {
    const email = `wp6-${userSequence}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    const passwordHash = await hash(TEST_PASSWORD, { type: 2 });
    await prisma.user.create({
      data: {
        displayName: "Trip User",
        email,
        normalizedEmail: email,
        passwordHash,
        role: "USER",
        status: "ACTIVE",
      },
    });
    return login(email, TEST_PASSWORD).then((result) => result.accessToken);
  }

  async function userIdOf(accessToken: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`);
    return response.body.id as string;
  }

  async function login(email: string, password: string) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password });
    expect(response.status).toBe(200);
    return {
      accessToken: response.body.accessToken as string,
      cookie: getRefreshCookieHeader(response.headers["set-cookie"]),
    };
  }

  function createTrip(token: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post("/api/v1/trips")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  function createTripItem(
    token: string,
    tripId: string,
    body: Record<string, unknown>,
  ) {
    return request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  function createPackingItem(
    token: string,
    tripId: string,
    body: Record<string, unknown>,
  ) {
    return request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/packing-items`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  function createTransaction(token: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  async function sendWithAuth(
    method: "DELETE" | "GET" | "PATCH" | "POST",
    path: string,
    token: string,
    body?: unknown,
  ) {
    const agent = request(app.getHttpServer());
    const call =
      method === "GET"
        ? agent.get(path)
        : method === "PATCH"
          ? agent.patch(path)
          : method === "DELETE"
            ? agent.delete(path)
            : agent.post(path);
    return call.set("Authorization", `Bearer ${token}`).send(body ?? {});
  }

  function getRefreshCookieHeader(
    setCookie: string | string[] | undefined,
  ): string {
    const cookie = Array.isArray(setCookie)
      ? (setCookie[0] ?? "")
      : (setCookie ?? "");
    const match = /^da_refresh=([^;]+)/.exec(cookie);
    return match?.[1] ? `da_refresh=${match[1]}` : "";
  }

  function configureApp(app: INestApplication): void {
    app.setGlobalPrefix("/api/v1");
    app.use(cookieParser());
    app.use(requestIdMiddleware);
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
  }
});
