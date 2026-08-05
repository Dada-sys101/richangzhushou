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
import { MemoryMailAdapter } from "../mail/memory-mail.adapter.js";
import { SecurityService } from "../common/security.service.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const TEST_PASSWORD = "UserPassword123!";
const ADMIN_PASSWORD = "AdminPassword123!";

const describeWithDb = testDatabaseUrl ? describe : describe.skip;

describeWithDb("WP2 identity, capacity, and admin integration", () => {
  let prisma: PrismaClient;
  let app1: INestApplication;
  let app2: INestApplication;
  let mailAdapter: MemoryMailAdapter;
  let securityService: SecurityService;
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

    mailAdapter = app1.get(MemoryMailAdapter);
    securityService = app1.get(SecurityService);
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
    mailAdapter.reset();
  });

  afterAll(async () => {
    await app1?.close();
    await app2?.close();
    await prisma?.$disconnect();
  });

  it("QA-CAP-001: 19 occupied + valid invite registers the 20th user", async () => {
    await createUsers(18, "ACTIVE");
    const invite = await createInvite();

    const response = await register({
      email: email("cap001"),
      inviteCode: invite,
    });

    expect(response.status).toBe(201);
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.refreshToken).toBeUndefined();
    expect(await occupiedCount()).toBe(20);
    const storedInvite = await prisma.inviteCode.findUnique({
      where: { codeHash: hashCode(invite) },
    });
    expect(storedInvite?.usedCount).toBe(1);
  });

  it("QA-CAP-002: full capacity rejects registration and does not consume invite", async () => {
    await createUsers(19, "ACTIVE");
    const invite = await createInvite();

    const response = await register({
      email: email("cap002"),
      inviteCode: invite,
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("CAPACITY_REACHED");
    expect(await occupiedCount()).toBe(20);
    const storedInvite = await prisma.inviteCode.findUnique({
      where: { codeHash: hashCode(invite) },
    });
    expect(storedInvite?.usedCount).toBe(0);
    expect(await prisma.user.count()).toBe(20);
  });

  it("QA-CAP-003: two independent connections racing for the last slot allow exactly one", async () => {
    await createUsers(18, "ACTIVE");
    const invite = await createInvite();

    const [first, second] = await Promise.all([
      registerOn(app1, email("cap003a"), invite),
      registerOn(app2, email("cap003b"), invite),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(await occupiedCount()).toBe(20);
    const storedInvite = await prisma.inviteCode.findUnique({
      where: { codeHash: hashCode(invite) },
    });
    expect(storedInvite?.usedCount).toBe(1);
  });

  it("QA-CAP-004: closing an active account releases capacity and revokes sessions", async () => {
    await createUsers(18, "ACTIVE");
    const userId = await createUser(email("cap004"), "ACTIVE");
    const session = await login(email("cap004"), TEST_PASSWORD);

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
  });

  it("QA-CAP-005: a closed user cannot reopen when capacity is full", async () => {
    await createUsers(20, "ACTIVE");
    const closedUserId = await createUser(email("cap005"), "CLOSED");

    await request(app1.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: email("cap005") })
      .expect(202);
    const recoveryToken = mailAdapter.getLatestToken(email("cap005"), "REOPEN");
    expect(recoveryToken).toBeTruthy();

    const reopenResponse = await request(app1.getHttpServer())
      .post("/api/v1/me/reopen")
      .send({ newPassword: "NewPassword123!", recoveryToken });
    expect(reopenResponse.status).toBe(409);
    expect(reopenResponse.body.code).toBe("REOPEN_CAPACITY_REACHED");

    const closedUser = await prisma.user.findUniqueOrThrow({
      where: { id: closedUserId },
    });
    expect(closedUser.status).toBe("CLOSED");
    const code = await prisma.recoveryCode.findFirst({
      where: { userId: closedUserId },
    });
    expect(code?.usedAt).toBeNull();
  });

  it("reopens a closed account when capacity is available and issues a session", async () => {
    await createUsers(18, "ACTIVE");
    const closedUserId = await createUser(email("reopenok"), "CLOSED");
    await request(app1.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: email("reopenok") })
      .expect(202);
    const recoveryToken = mailAdapter.getLatestToken(
      email("reopenok"),
      "REOPEN",
    );
    expect(recoveryToken).toBeTruthy();

    const reopenResponse = await request(app1.getHttpServer())
      .post("/api/v1/me/reopen")
      .send({ newPassword: "NewPassword123!", recoveryToken });
    expect(reopenResponse.status).toBe(200);
    expect(reopenResponse.body.accessToken).toBeTruthy();
    expect(reopenResponse.body.refreshToken).toBeUndefined();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: closedUserId },
    });
    expect(user.status).toBe("ACTIVE");
    expect(await occupiedCount()).toBe(20);
  });

  it("QA-CAP-006: suspended users still occupy capacity and cannot log in", async () => {
    await createUsers(18, "ACTIVE");
    const suspendedId = await createUser(email("cap006"), "SUSPENDED");
    expect(await occupiedCount()).toBe(20);

    const loginResponse = await request(app1.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: email("cap006"), password: TEST_PASSWORD });
    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.code).toBe("ACCOUNT_NOT_ACTIVE");

    const admin = await login("admin@example.com", ADMIN_PASSWORD);
    const suspendResponse = await request(app1.getHttpServer())
      .post(`/api/v1/admin/users/${suspendedId}/suspend`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "capacity test" });
    expect(suspendResponse.status).toBe(204);
    expect(await occupiedCount()).toBe(20);
  });

  it("rotates refresh tokens and revokes the previous session", async () => {
    await createUser(email("rot001"), "ACTIVE");
    const first = await login(email("rot001"), TEST_PASSWORD);

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
    await createUser(email("rev001"), "ACTIVE");
    const first = await login(email("rev001"), TEST_PASSWORD);
    const second = await login(email("rev001"), TEST_PASSWORD);

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

  it("password reset is non-enumerating, single-use, and revokes old sessions", async () => {
    const userId = await createUser(email("pw001"), "ACTIVE");
    const before = await login(email("pw001"), TEST_PASSWORD);

    const missing = await request(app1.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: "missing@example.com" });
    expect(missing.status).toBe(202);

    await request(app1.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: email("pw001") })
      .expect(202);
    const recoveryToken = mailAdapter.getLatestToken(
      email("pw001"),
      "PASSWORD_RESET",
    );
    expect(recoveryToken).toBeTruthy();

    const reset = await request(app1.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ newPassword: "ResetPassword123!", recoveryToken });
    expect(reset.status).toBe(204);

    const reuse = await request(app1.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ newPassword: "AnotherPassword123!", recoveryToken });
    expect([400, 409, 410]).toContain(reuse.status);

    const oldLogin = await request(app1.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: email("pw001"), password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app1.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: email("pw001"), password: "ResetPassword123!" });
    expect(newLogin.status).toBe(200);

    const refreshBefore = await request(app1.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", before.cookie);
    expect(refreshBefore.status).toBe(401);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(stored.passwordHash).not.toContain("ResetPassword123!");
  });

  it("limits forgot-password attempts", async () => {
    for (let index = 0; index < 5; index += 1) {
      await request(app1.getHttpServer())
        .post("/api/v1/auth/forgot-password")
        .send({ email: "ratelimit@example.com" })
        .expect(202);
    }
    const limited = await request(app1.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: "ratelimit@example.com" });
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
  });

  it("does not allow the capacity limit to drop below current usage", async () => {
    await createUsers(5, "ACTIVE");
    const admin = await login("admin@example.com", ADMIN_PASSWORD);

    const bad = await request(app1.getHttpServer())
      .patch("/api/v1/admin/settings/registration")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ maxActiveUsers: 1, reason: "lowering below usage" });
    expect(bad.status).toBe(409);
    expect(bad.body.code).toBe("SETTING_LOWER_THAN_USAGE");

    const good = await request(app1.getHttpServer())
      .patch("/api/v1/admin/settings/registration")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ maxActiveUsers: 10, reason: "raising capacity" });
    expect(good.status).toBe(200);
    expect(good.body.maxActiveUsers).toBe(10);
  });

  it("records redacted audit entries for every administrative write", async () => {
    const admin = await login("admin@example.com", ADMIN_PASSWORD);
    const user = await createUser(email("audit001"), "ACTIVE");

    await request(app1.getHttpServer())
      .patch("/api/v1/admin/settings/registration")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ registrationEnabled: true, reason: "enable registration" })
      .expect(200);
    const inviteResponse = await request(app1.getHttpServer())
      .post("/api/v1/admin/invites")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ maxUses: 1, reason: "create invite" })
      .expect(201);
    await request(app1.getHttpServer())
      .post(`/api/v1/admin/invites/${inviteResponse.body.invite.id}/revoke`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "revoke invite" })
      .expect(204);
    await request(app1.getHttpServer())
      .post(`/api/v1/admin/users/${user}/suspend`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "suspend user" })
      .expect(204);
    await request(app1.getHttpServer())
      .post(`/api/v1/admin/users/${user}/reopen`)
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
        "INVITE_CREATE",
        "INVITE_REVOKE",
        "USER_SUSPEND",
        "USER_REOPEN",
      ]),
    );
    for (const item of audits.body.items as Array<{
      actorEmail: string;
      reason: string;
    }>) {
      expect(item.reason.length).toBeGreaterThan(0);
      expect(item.actorEmail).toContain("***");
    }
  });

  it("admin close releases capacity, revokes sessions, and is audited", async () => {
    await createUsers(18, "ACTIVE");
    const targetId = await createUser(email("adminclose"), "ACTIVE");
    const targetLogin = await login(email("adminclose"), TEST_PASSWORD);
    const admin = await login("admin@example.com", ADMIN_PASSWORD);

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
    const targetId = await createUser(email("deletion"), "ACTIVE");
    const session = await login(email("deletion"), TEST_PASSWORD);

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
  });

  it("QA-SEC-001: one user cannot observe or revoke another user's session", async () => {
    await createUser(email("seca"), "ACTIVE");
    const bId = await createUser(email("secb"), "ACTIVE");
    const bSession = await login(email("secb"), TEST_PASSWORD);
    const sessionRow = await prisma.session.findFirstOrThrow({
      where: { userId: bId },
    });
    const a = await login(email("seca"), TEST_PASSWORD);

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
    const admin = await login("admin@example.com", ADMIN_PASSWORD);
    const paths: Array<{ path: string; status: number }> = [
      // WP3 implements finance endpoints; admin is rejected by UserOnlyGuard.
      { path: "/api/v1/transactions", status: 403 },
      // WP5 implements calendar and task endpoints; admin is rejected by UserOnlyGuard.
      { path: "/api/v1/calendar-events", status: 403 },
      { path: "/api/v1/tasks", status: 403 },
      { path: "/api/v1/trips", status: 404 },
    ];
    for (const { path, status } of paths) {
      const response = await request(app1.getHttpServer())
        .get(path)
        .set("Authorization", `Bearer ${admin.accessToken}`);
      expect(response.status).toBe(status);
    }
  });

  it("QA-SEC-003: database stores only hashes and no plaintext auth secrets", async () => {
    const invite = await createInvite();
    const registered = await register({
      email: email("secc"),
      inviteCode: invite,
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { normalizedEmail: email("secc") },
    });
    const session = await prisma.session.findFirstOrThrow({
      where: { userId: user.id },
    });
    const storedInvite = await prisma.inviteCode.findUnique({
      where: { codeHash: hashCode(invite) },
    });
    const cookieValue = getRefreshCookieValue(
      registered.headers["set-cookie"] as string[] | undefined,
    );

    expect(storedInvite?.codeHash).not.toBe(invite);
    expect(storedInvite?.codePrefix).not.toBe(invite);
    expect(session.refreshTokenHash).not.toBe(cookieValue);
    expect(user.passwordHash).not.toContain("UserPassword");

    await request(app1.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .send({ email: email("secc") })
      .expect(202);
    const recoveryToken = mailAdapter.getLatestToken(
      email("secc"),
      "PASSWORD_RESET",
    );
    const recovery = await prisma.recoveryCode.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(recovery.tokenHash).not.toBe(recoveryToken);
  });

  async function resetDatabase(): Promise<void> {
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

  async function createUsers(count: number, status: "ACTIVE" | "SUSPENDED") {
    for (let index = 0; index < count; index += 1) {
      await createUser(email(`bulk${userSequence}-${index}`), status);
    }
  }

  async function createUser(
    userEmail: string,
    status: "ACTIVE" | "SUSPENDED" | "CLOSED",
  ): Promise<string> {
    const passwordHash = await hash(TEST_PASSWORD, { type: 2 });
    const user = await prisma.user.create({
      data: {
        displayName: userEmail.split("@")[0] ?? "User",
        email: userEmail,
        normalizedEmail: userEmail,
        passwordHash,
        role: "USER",
        status,
        closedAt: status === "CLOSED" ? new Date() : null,
      },
    });
    return user.id;
  }

  async function createInvite(): Promise<string> {
    const admin = await login("admin@example.com", ADMIN_PASSWORD);
    const response = await request(app1.getHttpServer())
      .post("/api/v1/admin/invites")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ maxUses: 1, reason: "integration test invite" })
      .expect(201);
    return response.body.plaintextCode as string;
  }

  async function login(userEmail: string, password: string) {
    const response = await request(app1.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: userEmail, password });
    expect(response.status).toBe(200);
    return {
      accessToken: response.body.accessToken as string,
      cookie: getRefreshCookieHeader(response.headers["set-cookie"]),
    };
  }

  async function register(options: { email: string; inviteCode?: string }) {
    return request(app1.getHttpServer()).post("/api/v1/auth/register").send({
      displayName: "Integration User",
      email: options.email,
      inviteCode: options.inviteCode,
      password: TEST_PASSWORD,
    });
  }

  async function registerOn(
    app: INestApplication,
    userEmail: string,
    inviteCode: string,
  ) {
    return request(app.getHttpServer()).post("/api/v1/auth/register").send({
      displayName: "Integration User",
      email: userEmail,
      inviteCode,
      password: TEST_PASSWORD,
    });
  }

  async function occupiedCount(): Promise<number> {
    return prisma.user.count({
      where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
    });
  }

  function email(label: string): string {
    return `${label}-${userSequence}@example.com`;
  }

  function hashCode(code: string): string {
    return securityService.sha256(code);
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
