import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hash } from "argon2";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppModule } from "../app.module.js";
import { AllExceptionsFilter } from "../common/all-exceptions.filter.js";
import { RateLimiterService } from "../common/rate-limiter.service.js";
import { requestIdMiddleware } from "../common/request-id.middleware.js";
import { PrismaClient } from "../generated/prisma/client.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const TEST_PASSWORD = "UserPassword123!";
const ADMIN_PASSWORD = "AdminPassword123!";

const describeWithDb = testDatabaseUrl ? describe : describe.skip;

describeWithDb("WP2 identity, capacity, and admin integration", () => {
  let prisma: PrismaClient;
  let app1: INestApplication;
  let app2: INestApplication;
  let userSequence = 0;

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      return;
    }
    process.env.DATABASE_URL = testDatabaseUrl;
    prisma = new PrismaClient({
      adapter: new PrismaMariaDb(testDatabaseUrl),
    });

    const module1 = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app1 = module1.createNestApplication();
    configureApp(app1);
    await app1.init();

    const module2 = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app2 = module2.createNestApplication();
    configureApp(app2);
    await app2.init();
  });

  beforeEach(async () => {
    if (!prisma) {
      return;
    }
    userSequence += 1;
    await resetDatabase();
    await seedAdmin();
    app1.get(RateLimiterService).reset();
    app2.get(RateLimiterService).reset();
  });

  afterAll(async () => {
    await app1?.close();
    await app2?.close();
    await prisma?.$disconnect();
  });

  it("QA-CAP-001: 19 occupied slots accept the 20th user created by an admin", async () => {
    await createUsers(18, "ACTIVE");
    const admin = await login("admin", ADMIN_PASSWORD);

    const response = await createUserViaAdmin(admin.accessToken, {
      reason: "capacity test",
      username: username("cap001"),
    });

    expect(response.status).toBe(201);
    expect(response.body.username).toBe(username("cap001"));
    expect(response.body.mustChangePassword).toBe(true);
    expect(await occupiedCount()).toBe(20);
  });

  it("QA-CAP-002: full capacity rejects admin-created accounts", async () => {
    await createUsers(19, "ACTIVE");
    const admin = await login("admin", ADMIN_PASSWORD);

    const response = await createUserViaAdmin(admin.accessToken, {
      reason: "capacity test",
      username: username("cap002"),
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("CAPACITY_REACHED");
    expect(await occupiedCount()).toBe(20);
    expect(await prisma.user.count()).toBe(20);
  });

  it("QA-CAP-003: two admins racing for the last slot allow exactly one account", async () => {
    await createUsers(18, "ACTIVE");
    const admin1 = await login("admin", ADMIN_PASSWORD);
    const admin2 = await loginOn(app2, "admin", ADMIN_PASSWORD);

    const [first, second] = await Promise.all([
      createUserViaAdminOn(app1, admin1.accessToken, {
        reason: "race test a",
        username: username("cap003a"),
      }),
      createUserViaAdminOn(app2, admin2.accessToken, {
        reason: "race test b",
        username: username("cap003b"),
      }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(await occupiedCount()).toBe(20);
  });

  it("QA-CAP-004: closing an active account releases capacity and revokes sessions", async () => {
    await createUsers(18, "ACTIVE");
    const userId = await createUser(username("cap004"), "ACTIVE");
    const session = await login(username("cap004"), TEST_PASSWORD);

    const closeResponse = await request(app1.getHttpServer())
      .post("/api/v1/me/close")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ password: TEST_PASSWORD, reason: "closing test account" });
    expect(closeResponse.status).toBe(204);

    const meResponse = await request(app1.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${session.accessToken}`);
    expect(meResponse.status).toBe(401);
    const refreshResponse = await request(app1.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", session.cookie);
    expect(refreshResponse.status).toBe(401);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe("CLOSED");
    expect(await occupiedCount()).toBe(19);
    const closeAudit = await prisma.adminAudit.findFirst({
      where: { action: "USER_CLOSE", targetId: userId },
    });
    expect(closeAudit).not.toBeNull();
    expect(closeAudit?.actorId).toBe(userId);
    expect(closeAudit?.reason).toBe("closing test account");
    expect(JSON.stringify(closeAudit?.beforeJson)).toContain("ACTIVE");
    expect(JSON.stringify(closeAudit?.afterJson)).toContain("CLOSED");
    expect(JSON.stringify(closeAudit)).not.toContain(TEST_PASSWORD);
    expect(JSON.stringify(closeAudit)).not.toContain(username("cap004"));
  });

  it("QA-CAP-005: an admin cannot reopen a closed user when capacity is full", async () => {
    await createUsers(20, "ACTIVE");
    const closedUserId = await createUser(username("cap005"), "CLOSED");
    const admin = await login("admin", ADMIN_PASSWORD);

    const reopenResponse = await request(app1.getHttpServer())
      .post(`/api/v1/admin/users/${closedUserId}/reopen`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "reopen full test" });
    expect(reopenResponse.status).toBe(409);
    expect(reopenResponse.body.code).toBe("CAPACITY_REACHED");

    const closedUser = await prisma.user.findUniqueOrThrow({
      where: { id: closedUserId },
    });
    expect(closedUser.status).toBe("CLOSED");
  });

  it("reopens a closed account when capacity is available", async () => {
    await createUsers(18, "ACTIVE");
    const closedUserId = await createUser(username("reopenok"), "CLOSED");
    const admin = await login("admin", ADMIN_PASSWORD);

    const reopenResponse = await request(app1.getHttpServer())
      .post(`/api/v1/admin/users/${closedUserId}/reopen`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "reopen ok test" });
    expect(reopenResponse.status).toBe(204);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: closedUserId },
    });
    expect(user.status).toBe("ACTIVE");
    expect(await occupiedCount()).toBe(20);
  });

  it("QA-CAP-006: suspended users still occupy capacity and cannot log in", async () => {
    await createUsers(18, "ACTIVE");
    const suspendedId = await createUser(username("cap006"), "SUSPENDED");
    expect(await occupiedCount()).toBe(20);

    const loginResponse = await request(app1.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ password: TEST_PASSWORD, username: username("cap006") });
    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.code).toBe("ACCOUNT_NOT_ACTIVE");

    const admin = await login("admin", ADMIN_PASSWORD);
    const suspendResponse = await request(app1.getHttpServer())
      .post(`/api/v1/admin/users/${suspendedId}/suspend`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "capacity test" });
    expect(suspendResponse.status).toBe(204);
    expect(await occupiedCount()).toBe(20);
  });

  it("first login after admin creation forces a password change", async () => {
    const admin = await login("admin", ADMIN_PASSWORD);
    const created = await createUserViaAdmin(admin.accessToken, {
      reason: "forced change test",
      username: username("pwdchange"),
    });
    expect(created.status).toBe(201);

    const loginResponse = await request(app1.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ password: TEST_PASSWORD, username: username("pwdchange") });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.mustChangePassword).toBe(true);
    const accessToken = loginResponse.body.accessToken as string;

    const blocked = await request(app1.getHttpServer())
      .get("/api/v1/transactions")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const me = await request(app1.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(me.status).toBe(200);

    const changed = await request(app1.getHttpServer())
      .post("/api/v1/me/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        currentPassword: TEST_PASSWORD,
        newPassword: "ChangedPassword123!",
      });
    expect(changed.status).toBe(204);

    const allowed = await request(app1.getHttpServer())
      .get("/api/v1/transactions")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(allowed.status).toBe(200);

    const oldLogin = await request(app1.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ password: TEST_PASSWORD, username: username("pwdchange") });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app1.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        password: "ChangedPassword123!",
        username: username("pwdchange"),
      });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.mustChangePassword).toBe(false);
  });

  it("admin password reset forces a change and revokes sessions", async () => {
    const userId = await createUser(username("reset001"), "ACTIVE");
    const before = await login(username("reset001"), TEST_PASSWORD);
    const admin = await login("admin", ADMIN_PASSWORD);

    const resetResponse = await request(app1.getHttpServer())
      .post(`/api/v1/admin/users/${userId}/reset-password`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ newPassword: "ResetPassword123!", reason: "reset test" });
    expect(resetResponse.status).toBe(204);

    const refreshBefore = await request(app1.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", before.cookie);
    expect(refreshBefore.status).toBe(401);

    const newLogin = await request(app1.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        password: "ResetPassword123!",
        username: username("reset001"),
      });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.mustChangePassword).toBe(true);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(stored.mustChangePassword).toBe(true);
    expect(stored.passwordHash).not.toContain("ResetPassword123!");
  });

  it("rejects duplicate usernames with a conflict", async () => {
    const admin = await login("admin", ADMIN_PASSWORD);
    await createUserViaAdmin(admin.accessToken, {
      reason: "duplicate test",
      username: username("dup001"),
    }).expect(201);

    const duplicate = await createUserViaAdmin(admin.accessToken, {
      reason: "duplicate test",
      username: username("dup001"),
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("DUPLICATE_RESOURCE");
  });

  it("rotates refresh tokens and revokes the previous session", async () => {
    await createUser(username("rot001"), "ACTIVE");
    const first = await login(username("rot001"), TEST_PASSWORD);

    const refresh1 = await request(app1.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", first.cookie);
    expect(refresh1.status).toBe(200);
    const newCookie = getRefreshCookieHeader(refresh1.headers["set-cookie"]);

    const reuseOld = await request(app1.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", first.cookie);
    expect(reuseOld.status).toBe(401);

    const refresh2 = await request(app1.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", newCookie);
    expect(refresh2.status).toBe(200);
  });

  it("revokes every session and each individual session on demand", async () => {
    await createUser(username("rev001"), "ACTIVE");
    const first = await login(username("rev001"), TEST_PASSWORD);
    const second = await login(username("rev001"), TEST_PASSWORD);

    await request(app1.getHttpServer())
      .delete("/api/v1/me/sessions")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(204);

    const refresh1 = await request(app1.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", first.cookie);
    expect(refresh1.status).toBe(401);
    const refresh2 = await request(app1.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", second.cookie);
    expect(refresh2.status).toBe(401);
  });

  it("limits login attempts by username", async () => {
    await createUser(username("ratelimit"), "ACTIVE");
    for (let index = 0; index < 10; index += 1) {
      await request(app1.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          password: "WrongPassword123!",
          username: username("ratelimit"),
        })
        .expect(401);
    }
    const limited = await request(app1.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ password: TEST_PASSWORD, username: username("ratelimit") });
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
  });

  it("does not allow the capacity limit to drop below current usage", async () => {
    await createUsers(5, "ACTIVE");
    const admin = await login("admin", ADMIN_PASSWORD);

    const bad = await request(app1.getHttpServer())
      .patch("/api/v1/admin/settings")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ maxActiveUsers: 1, reason: "lowering below usage" });
    expect(bad.status).toBe(409);
    expect(bad.body.code).toBe("SETTING_LOWER_THAN_USAGE");

    const good = await request(app1.getHttpServer())
      .patch("/api/v1/admin/settings")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ maxActiveUsers: 10, reason: "raising capacity" });
    expect(good.status).toBe(200);
    expect(good.body.maxActiveUsers).toBe(10);
  });

  it("records redacted audit entries for every administrative write", async () => {
    const admin = await login("admin", ADMIN_PASSWORD);
    const created = await createUserViaAdmin(admin.accessToken, {
      reason: "audit create",
      username: username("audit001"),
    });
    expect(created.status).toBe(201);
    const userId = created.body.id as string;

    await request(app1.getHttpServer())
      .patch("/api/v1/admin/settings")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ maxActiveUsers: 25, reason: "raise capacity" })
      .expect(200);
    await request(app1.getHttpServer())
      .post(`/api/v1/admin/users/${userId}/reset-password`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ newPassword: "AuditPassword123!", reason: "audit reset" })
      .expect(204);
    await request(app1.getHttpServer())
      .post(`/api/v1/admin/users/${userId}/suspend`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "suspend user" })
      .expect(204);
    await request(app1.getHttpServer())
      .post(`/api/v1/admin/users/${userId}/reopen`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "reopen user" })
      .expect(204);

    const audits = await request(app1.getHttpServer())
      .get("/api/v1/admin/audits")
      .set("Authorization", `Bearer ${admin.accessToken}`);
    expect(audits.status).toBe(200);
    const actions = audits.body.items.map(
      (item: { action: string }) => item.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        "SETTINGS_UPDATE",
        "USER_CREATE",
        "USER_PASSWORD_RESET",
        "USER_SUSPEND",
        "USER_REOPEN",
      ]),
    );
    const serialized = JSON.stringify(audits.body.items);
    expect(serialized).not.toContain("AuditPassword123!");
    expect(serialized).not.toContain("UserPassword123!");
    for (const item of audits.body.items as Array<{
      actorUsername: string | null;
      reason: string;
    }>) {
      expect(item.reason.length).toBeGreaterThan(0);
      expect(item.actorUsername).toBe("admin");
    }
  });

  it("admin close releases capacity, revokes sessions, and is audited", async () => {
    await createUsers(18, "ACTIVE");
    const targetId = await createUser(username("adminclose"), "ACTIVE");
    const targetLogin = await login(username("adminclose"), TEST_PASSWORD);
    const admin = await login("admin", ADMIN_PASSWORD);

    const closeResponse = await request(app1.getHttpServer())
      .post(`/api/v1/admin/users/${targetId}/close`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "admin close test" });
    expect(closeResponse.status).toBe(204);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: targetId },
    });
    expect(user.status).toBe("CLOSED");
    expect(await occupiedCount()).toBe(19);
    const refresh = await request(app1.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", targetLogin.cookie);
    expect(refresh.status).toBe(401);

    const audits = await request(app1.getHttpServer())
      .get("/api/v1/admin/audits")
      .set("Authorization", `Bearer ${admin.accessToken}`);
    expect(
      audits.body.items.some(
        (item: { action: string }) => item.action === "USER_CLOSE",
      ),
    ).toBe(true);
  });

  it("requesting deletion enters retention, releases capacity, and revokes sessions", async () => {
    await createUsers(18, "ACTIVE");
    const targetId = await createUser(username("deletion"), "ACTIVE");
    const session = await login(username("deletion"), TEST_PASSWORD);

    const deletionResponse = await request(app1.getHttpServer())
      .post("/api/v1/me/request-deletion")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ password: TEST_PASSWORD, reason: "user deletion test" });
    expect(deletionResponse.status).toBe(202);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: targetId },
    });
    expect(user.status).toBe("DELETION_PENDING");
    expect(user.deletionRequestedAt).not.toBeNull();
    expect(await occupiedCount()).toBe(19);
    const refresh = await request(app1.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", session.cookie);
    expect(refresh.status).toBe(401);
    const deletionAudit = await prisma.adminAudit.findFirst({
      where: { action: "USER_DELETE_REQUEST", targetId },
    });
    expect(deletionAudit).not.toBeNull();
    expect(deletionAudit?.actorId).toBe(targetId);
    expect(deletionAudit?.reason).toBe("user deletion test");
    expect(JSON.stringify(deletionAudit?.afterJson)).toContain(
      "DELETION_PENDING",
    );
    expect(JSON.stringify(deletionAudit)).not.toContain(TEST_PASSWORD);
    expect(JSON.stringify(deletionAudit)).not.toContain(username("deletion"));
  });

  it("QA-SEC-001: one user cannot observe or revoke another user's session", async () => {
    await createUser(username("seca"), "ACTIVE");
    const bId = await createUser(username("secb"), "ACTIVE");
    const bSession = await login(username("secb"), TEST_PASSWORD);
    const sessionRow = await prisma.session.findFirstOrThrow({
      where: { userId: bId },
    });
    const a = await login(username("seca"), TEST_PASSWORD);

    const response = await request(app1.getHttpServer())
      .delete(`/api/v1/me/sessions/${sessionRow.id}`)
      .set("Authorization", `Bearer ${a.accessToken}`);
    expect(response.status).toBe(404);
    const stillValid = await request(app1.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", bSession.cookie);
    expect(stillValid.status).toBe(200);
  });

  it("QA-SEC-002: admin role cannot reach user content endpoints", async () => {
    const admin = await login("admin", ADMIN_PASSWORD);
    const paths: Array<{ path: string; status: number }> = [
      { path: "/api/v1/transactions", status: 403 },
      { path: "/api/v1/calendar-events", status: 403 },
      { path: "/api/v1/tasks", status: 403 },
      { path: "/api/v1/trips", status: 403 },
    ];
    for (const { path, status } of paths) {
      const response = await request(app1.getHttpServer())
        .get(path)
        .set("Authorization", `Bearer ${admin.accessToken}`);
      expect(response.status).toBe(status);
    }
  });

  it("QA-SEC-003: database stores only hashes and no plaintext auth secrets", async () => {
    const admin = await login("admin", ADMIN_PASSWORD);
    const created = await createUserViaAdmin(admin.accessToken, {
      reason: "hash test",
      username: username("secc"),
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { normalizedUsername: username("secc") },
    });
    const loginResponse = await request(app1.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ password: TEST_PASSWORD, username: username("secc") });
    const session = await prisma.session.findFirstOrThrow({
      where: { userId: user.id },
    });
    const cookieValue = getRefreshCookieValue(
      loginResponse.headers["set-cookie"] as string[] | undefined,
    );

    expect(user.passwordHash).not.toContain("UserPassword");
    expect(session.refreshTokenHash).not.toBe(cookieValue);
    const audit = await prisma.adminAudit.findFirst({
      where: { action: "USER_CREATE", targetId: created.body.id },
    });
    expect(JSON.stringify(audit)).not.toContain(TEST_PASSWORD);
    expect(JSON.stringify(audit)).not.toContain("UserPassword");
  });

  async function resetDatabase(): Promise<void> {
    await prisma.packingItem.deleteMany();
    await prisma.tripItem.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.session.deleteMany();
    await prisma.adminAudit.deleteMany();
    await prisma.user.deleteMany();
    await prisma.systemSetting.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        maxActiveUsers: 20,
      },
      update: {
        maxActiveUsers: 20,
      },
    });
  }

  async function seedAdmin(): Promise<void> {
    const passwordHash = await hash(ADMIN_PASSWORD, { type: 2 });
    await prisma.user.create({
      data: {
        displayName: "Admin",
        normalizedUsername: "admin",
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        username: "admin",
      },
    });
  }

  async function createUsers(count: number, status: "ACTIVE" | "SUSPENDED") {
    for (let index = 0; index < count; index += 1) {
      await createUser(username(`bulk${index}`), status);
    }
  }

  async function createUser(
    userUsername: string,
    status: "ACTIVE" | "SUSPENDED" | "CLOSED",
  ): Promise<string> {
    const passwordHash = await hash(TEST_PASSWORD, { type: 2 });
    const user = await prisma.user.create({
      data: {
        displayName: "Integration User",
        normalizedUsername: userUsername,
        passwordHash,
        role: "USER",
        status,
        username: userUsername,
        closedAt: status === "CLOSED" ? new Date() : null,
      },
    });
    return user.id;
  }

  function createUserViaAdmin(
    accessToken: string,
    options: { reason: string; username: string },
  ) {
    return createUserViaAdminOn(app1, accessToken, options);
  }

  function createUserViaAdminOn(
    app: INestApplication,
    accessToken: string,
    options: { reason: string; username: string },
  ) {
    return request(app.getHttpServer())
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "Integration User",
        initialPassword: TEST_PASSWORD,
        reason: options.reason,
        username: options.username,
      });
  }

  async function login(userUsername: string, password: string) {
    return loginOn(app1, userUsername, password);
  }

  async function loginOn(
    app: INestApplication,
    userUsername: string,
    password: string,
  ) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ password, username: userUsername });
    expect(response.status).toBe(200);
    return {
      accessToken: response.body.accessToken as string,
      cookie: getRefreshCookieHeader(response.headers["set-cookie"]),
      mustChangePassword: response.body.mustChangePassword as boolean,
    };
  }

  async function occupiedCount(): Promise<number> {
    return prisma.user.count({
      where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
    });
  }

  function username(label: string): string {
    return `wp2_${userSequence}_${label}`;
  }

  function getRefreshCookieValue(
    setCookie: string | string[] | undefined,
  ): string {
    const cookie = Array.isArray(setCookie)
      ? (setCookie[0] ?? "")
      : (setCookie ?? "");
    const match = /^da_refresh=([^;]+)/.exec(cookie);
    return match?.[1] ?? "";
  }

  function getRefreshCookieHeader(
    setCookie: string | string[] | undefined,
  ): string {
    const value = getRefreshCookieValue(setCookie);
    return value ? `da_refresh=${value}` : "";
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
