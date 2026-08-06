import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { hash } from "argon2";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppModule } from "../app.module.js";
import { AccountDeletionService } from "../account-deletion/account-deletion.service.js";
import { AuditService } from "../audit/audit.service.js";
import { AllExceptionsFilter } from "../common/all-exceptions.filter.js";
import { RateLimiterService } from "../common/rate-limiter.service.js";
import { SecurityService } from "../common/security.service.js";
import { requestIdMiddleware } from "../common/request-id.middleware.js";
import type { StorageAdapter } from "../integrations/integrations.types.js";
import { PrismaService } from "../prisma/prisma.service.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const TEST_PASSWORD = "UserPassword123!";
const ADMIN_PASSWORD = "AdminPassword123!";

const describeWithDb = testDatabaseUrl ? describe : describe.skip;

class FakeStorageAdapter implements StorageAdapter {
  private readonly files = new Map<string, Buffer>();
  failAlways = false;
  failNextDelete = false;

  put(key: string, data: Buffer): Promise<void> {
    this.files.set(key, data);
    return Promise.resolve();
  }

  get(key: string): Promise<Buffer> {
    const value = this.files.get(key);
    if (!value) {
      return Promise.reject(new Error(`File not found: ${key}`));
    }
    return Promise.resolve(value);
  }

  async delete(key: string): Promise<void> {
    if (this.failAlways || this.failNextDelete) {
      this.failNextDelete = false;
      throw new Error("simulated storage failure");
    }
    this.files.delete(key);
  }

  has(key: string): boolean {
    return this.files.has(key);
  }

  reset(): void {
    this.files.clear();
    this.failAlways = false;
    this.failNextDelete = false;
  }
}

describeWithDb("OPEN-007 expired account deletion cleanup", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let deletionService: AccountDeletionService;
  let storage: FakeStorageAdapter;
  let userSequence = 0;

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      return;
    }
    process.env.DATABASE_URL = testDatabaseUrl;
    prisma = new PrismaService();
    storage = new FakeStorageAdapter();
    deletionService = new AccountDeletionService(
      prisma,
      new SecurityService(),
      new AuditService(prisma),
      storage,
    );

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
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
    await app.init();
  });

  beforeEach(async () => {
    if (!prisma) {
      return;
    }
    userSequence += 1;
    await resetDatabase();
    await seedAdmin();
    storage.reset();
    app.get(RateLimiterService).reset();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it("schedules deletion at the retention deadline when requested", async () => {
    const userId = await createActiveUser(username("sched"));
    const session = await login(username("sched"), TEST_PASSWORD);
    const requestedAt = new Date();

    const response = await request(app.getHttpServer())
      .post("/api/v1/me/request-deletion")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ password: TEST_PASSWORD, reason: "schedule deletion test" });
    expect(response.status).toBe(202);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe("DELETION_PENDING");
    expect(user.deletionRequestedAt).not.toBeNull();
    expect(user.deletionScheduledAt).not.toBeNull();
    const retentionDays =
      (user.deletionScheduledAt!.getTime() - requestedAt.getTime()) /
      (24 * 60 * 60 * 1000);
    expect(retentionDays).toBeGreaterThan(29);
    expect(retentionDays).toBeLessThan(31);

    const audit = await prisma.adminAudit.findFirst({
      where: { action: "USER_DELETE_REQUEST", targetId: userId },
    });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit?.afterJson)).toContain("DELETION_PENDING");
    expect(JSON.stringify(audit?.afterJson)).toContain("deletionScheduledAt");
    expect(JSON.stringify(audit)).not.toContain(TEST_PASSWORD);
    expect(JSON.stringify(audit)).not.toContain(username("sched"));
  });

  it("does not claim a pending user before the retention deadline", async () => {
    const userId = await createActiveUser(username("notdue"));
    await requestDeletion(username("notdue"));
    await prisma.user.update({
      data: { deletionScheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      where: { id: userId },
    });

    const result = await deletionService.runCleanup();
    expect(result).toEqual({ claimed: 0, completed: 0, failed: 0 });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe("DELETION_PENDING");
  });

  it("deletes all business data, attachments, credentials, and creates an anonymous tombstone", async () => {
    const userId = await createActiveUser(username("full"));
    await seedUserData(userId);
    const original = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    await requestDeletion(username("full"));
    await expireDeletion(userId);

    const result = await deletionService.runCleanup();
    expect(result).toEqual({ claimed: 1, completed: 1, failed: 0 });

    expect(await prisma.session.count({ where: { userId } })).toBe(0);
    expect(await prisma.deviceCredential.count({ where: { userId } })).toBe(0);
    expect(await prisma.category.count({ where: { userId } })).toBe(0);
    expect(await prisma.financialAccount.count({ where: { userId } })).toBe(0);
    expect(await prisma.transaction.count({ where: { userId } })).toBe(0);
    expect(await prisma.budget.count({ where: { userId } })).toBe(0);
    expect(await prisma.draftRecord.count({ where: { userId } })).toBe(0);
    expect(await prisma.attachment.count({ where: { userId } })).toBe(0);
    expect(await prisma.calendarEvent.count({ where: { userId } })).toBe(0);
    expect(await prisma.task.count({ where: { userId } })).toBe(0);
    expect(await prisma.reminder.count({ where: { userId } })).toBe(0);
    expect(await prisma.trip.count({ where: { userId } })).toBe(0);
    expect(await prisma.syncMutation.count({ where: { userId } })).toBe(0);
    expect(storage.has(`attachments/${userId}/test.png`)).toBe(false);

    const tombstone = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(tombstone.status).toBe("DELETED");
    expect(tombstone.username).toMatch(/^deleted_[0-9a-f]{32}$/);
    expect(tombstone.normalizedUsername).toBe(tombstone.username);
    expect(tombstone.displayName).toBe("");
    expect(tombstone.mustChangePassword).toBe(false);
    expect(tombstone.deletionCompletedAt).not.toBeNull();
    expect(tombstone.deletionLastError).toBeNull();
    expect(tombstone.passwordHash).not.toBe(original.passwordHash);
    expect(tombstone.passwordHash).not.toContain(TEST_PASSWORD);

    await expect(
      prisma.user.create({
        data: {
          displayName: "Reused",
          normalizedUsername: username("full"),
          passwordHash: await hash(TEST_PASSWORD, { type: 2 }),
          role: "USER",
          status: "ACTIVE",
          username: username("full"),
        },
      }),
    ).resolves.toBeDefined();
  });

  it("lets only one of two concurrent runs claim the same user", async () => {
    const userId = await createActiveUser(username("race"));
    await requestDeletion(username("race"));
    await expireDeletion(userId);

    const [first, second] = await Promise.all([
      deletionService.runCleanup(),
      deletionService.runCleanup(),
    ]);
    expect(first.claimed + second.claimed).toBe(1);
    expect(first.completed + second.completed).toBe(1);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe("DELETED");
  });

  it("reclaims a stuck processing user after the lease expires", async () => {
    const userId = await createActiveUser(username("lease"));
    await requestDeletion(username("lease"));
    await prisma.user.update({
      data: {
        deletionAttemptCount: 1,
        deletionLeaseExpiresAt: new Date(Date.now() - 60_000),
        deletionScheduledAt: new Date(Date.now() - 60_000),
        status: "DELETION_PROCESSING",
      },
      where: { id: userId },
    });

    const result = await deletionService.runCleanup();
    expect(result).toEqual({ claimed: 1, completed: 1, failed: 0 });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe("DELETED");
  });

  it("does not mark DELETED on failure and retries after the lease expires", async () => {
    const userId = await createActiveUser(username("retry"));
    await seedUserData(userId);
    await requestDeletion(username("retry"));
    await expireDeletion(userId);
    storage.failNextDelete = true;

    const first = await deletionService.runCleanup();
    expect(first).toEqual({ claimed: 1, completed: 0, failed: 1 });
    const stuck = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(stuck.status).toBe("DELETION_PROCESSING");
    expect(stuck.deletionAttemptCount).toBe(1);
    expect(stuck.deletionCompletedAt).toBeNull();
    expect(stuck.deletionLastError).toContain("simulated storage failure");
    expect(storage.has(`attachments/${userId}/test.png`)).toBe(true);

    await prisma.user.update({
      data: { deletionLeaseExpiresAt: new Date(Date.now() - 1_000) },
      where: { id: userId },
    });
    const second = await deletionService.runCleanup();
    expect(second).toEqual({ claimed: 1, completed: 1, failed: 0 });
    const done = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(done.status).toBe("DELETED");
    expect(storage.has(`attachments/${userId}/test.png`)).toBe(false);
  });

  it("stops automatic retries at the maximum attempts and stays diagnosable", async () => {
    const userId = await createActiveUser(username("maxretry"));
    await seedUserData(userId);
    await requestDeletion(username("maxretry"));
    await expireDeletion(userId);
    storage.failAlways = true;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await deletionService.runCleanup();
      expect(result.claimed).toBe(1);
      expect(result.completed).toBe(0);
      expect(result.failed).toBe(1);
      await prisma.user.update({
        data: { deletionLeaseExpiresAt: new Date(Date.now() - 1_000) },
        where: { id: userId },
      });
    }

    const final = await deletionService.runCleanup();
    expect(final).toEqual({ claimed: 0, completed: 0, failed: 0 });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe("DELETION_PROCESSING");
    expect(user.deletionAttemptCount).toBe(5);
    expect(user.deletionLastError).toContain("simulated storage failure");
  });

  it("lets an admin cancel a pending deletion and prevents later cleanup", async () => {
    await createActiveUsers(17);
    const userId = await createActiveUser(username("cancel"));
    await requestDeletion(username("cancel"));
    const admin = await login("admin", ADMIN_PASSWORD);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${userId}/cancel-deletion`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "cancel deletion test" });
    expect(response.status).toBe(204);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe("ACTIVE");
    expect(user.deletionRequestedAt).toBeNull();
    expect(user.deletionScheduledAt).toBeNull();
    expect(await occupiedCount()).toBe(19);

    const result = await deletionService.runCleanup();
    expect(result).toEqual({ claimed: 0, completed: 0, failed: 0 });
    const audit = await prisma.adminAudit.findFirst({
      where: { action: "USER_DELETE_CANCEL", targetId: userId },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(
      (
        await prisma.user.findUniqueOrThrow({
          where: { normalizedUsername: "admin" },
        })
      ).id,
    );

    const loginAgain = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ password: TEST_PASSWORD, username: username("cancel") });
    expect(loginAgain.status).toBe(200);
  });

  it("rejects cancelling a deletion when capacity is full", async () => {
    await createActiveUsers(18);
    const userId = await createActiveUser(username("fullcancel"));
    await requestDeletion(username("fullcancel"));
    await createActiveUserRaw(username("filler"));
    const admin = await login("admin", ADMIN_PASSWORD);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${userId}/cancel-deletion`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ reason: "cancel full test" });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("CAPACITY_REACHED");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe("DELETION_PENDING");
  });

  it("redacts audit records for a deleted user and keeps a system completion audit", async () => {
    const userId = await createActiveUser(username("auditredact"));
    const session = await login(username("auditredact"), TEST_PASSWORD);
    await request(app.getHttpServer())
      .post("/api/v1/me/request-deletion")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ password: TEST_PASSWORD, reason: "sensitive reason text" })
      .expect(202);
    await expireDeletion(userId);
    await deletionService.runCleanup();

    const requestAudit = await prisma.adminAudit.findFirstOrThrow({
      where: { action: "USER_DELETE_REQUEST", targetId: userId },
    });
    expect(requestAudit.beforeJson).toBeNull();
    expect(requestAudit.afterJson).toBeNull();
    expect(requestAudit.reason).toBe("ACCOUNT_DELETION_CLEANUP_ANONYMIZED");
    const serialized = JSON.stringify(requestAudit);
    expect(serialized).not.toContain(username("auditredact"));
    expect(serialized).not.toContain("Integration User");
    expect(serialized).not.toContain(TEST_PASSWORD);
    expect(serialized).not.toContain("sensitive reason text");

    const completionAudit = await prisma.adminAudit.findFirstOrThrow({
      where: { action: "USER_DELETION_COMPLETED", targetId: userId },
    });
    expect(completionAudit.actorId).toBeNull();
    expect(JSON.stringify(completionAudit.afterJson)).toContain("DELETED");
  });

  it("is idempotent when run again after completion or with a missing file", async () => {
    const userId = await createActiveUser(username("idem"));
    await prisma.attachment.create({
      data: {
        contentStoredAt: null,
        mimeType: "image/png",
        objectKey: `attachments/${userId}/never-uploaded.png`,
        ownerType: "TRANSACTION_DRAFT",
        size: 0,
        userId,
      },
    });
    await requestDeletion(username("idem"));
    await expireDeletion(userId);

    const first = await deletionService.runCleanup();
    expect(first).toEqual({ claimed: 1, completed: 1, failed: 0 });
    const second = await deletionService.runCleanup();
    expect(second).toEqual({ claimed: 0, completed: 0, failed: 0 });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.status).toBe("DELETED");
  });

  async function resetDatabase(): Promise<void> {
    await prisma.packingItem.deleteMany();
    await prisma.tripItem.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.syncMutation.deleteMany();
    await prisma.reminder.deleteMany();
    await prisma.task.deleteMany();
    await prisma.calendarEvent.deleteMany();
    await prisma.draftRecord.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.financialAccount.deleteMany();
    await prisma.category.deleteMany();
    await prisma.deviceCredential.deleteMany();
    await prisma.session.deleteMany();
    await prisma.adminAudit.deleteMany();
    await prisma.user.deleteMany();
    await prisma.systemSetting.upsert({
      create: { id: "singleton", maxActiveUsers: 20 },
      update: { maxActiveUsers: 20 },
      where: { id: "singleton" },
    });
  }

  async function seedAdmin(): Promise<void> {
    await prisma.user.create({
      data: {
        displayName: "Admin",
        normalizedUsername: "admin",
        passwordHash: await hash(ADMIN_PASSWORD, { type: 2 }),
        role: "ADMIN",
        status: "ACTIVE",
        username: "admin",
      },
    });
  }

  async function createActiveUsers(count: number): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      await createActiveUserRaw(username(`bulk${index}`));
    }
  }

  async function createActiveUser(userUsername: string): Promise<string> {
    return createActiveUserRaw(userUsername);
  }

  async function createActiveUserRaw(userUsername: string): Promise<string> {
    const user = await prisma.user.create({
      data: {
        displayName: "Integration User",
        normalizedUsername: userUsername,
        passwordHash: await hash(TEST_PASSWORD, { type: 2 }),
        role: "USER",
        status: "ACTIVE",
        username: userUsername,
      },
    });
    return user.id;
  }

  async function seedUserData(userId: string): Promise<void> {
    const category = await prisma.category.create({
      data: { kind: "EXPENSE", name: "food", userId },
    });
    const account = await prisma.financialAccount.create({
      data: { kind: "CASH", name: "cash", userId },
    });
    const trip = await prisma.trip.create({
      data: {
        destination: "Somewhere",
        endDate: new Date("2026-08-08T00:00:00.000Z"),
        startDate: new Date("2026-08-06T00:00:00.000Z"),
        title: "Test trip",
        userId,
      },
    });
    await prisma.transaction.create({
      data: {
        accountId: account.id,
        amount: "12.34",
        categoryId: category.id,
        merchant: "shop",
        note: "secret note",
        occurredAt: new Date(),
        tripId: trip.id,
        type: "EXPENSE",
        userId,
      },
    });
    await prisma.budget.create({
      data: {
        amount: "100.00",
        categoryId: category.id,
        month: "2026-08",
        userId,
      },
    });
    await prisma.draftRecord.create({
      data: {
        payloadJson: { amount: "1.00", type: "EXPENSE" },
        source: "MANUAL",
        status: "PENDING",
        targetType: "TRANSACTION",
        userId,
      },
    });
    await prisma.attachment.create({
      data: {
        contentStoredAt: new Date(),
        mimeType: "image/png",
        objectKey: `attachments/${userId}/test.png`,
        ownerType: "TRANSACTION_DRAFT",
        sha256: "abc",
        size: 3,
        uploadTokenHash: `upload-${userId}`,
        userId,
      },
    });
    await storage.put(`attachments/${userId}/test.png`, Buffer.from([1, 2, 3]));
    await prisma.calendarEvent.create({
      data: {
        endsAt: new Date(Date.now() + 3_600_000),
        startsAt: new Date(),
        title: "Meeting",
        userId,
      },
    });
    await prisma.task.create({
      data: { title: "Task", userId },
    });
    await prisma.reminder.create({
      data: {
        scheduleType: "ONCE",
        scheduledAt: new Date(),
        startsAt: new Date(),
        title: "Reminder",
        userId,
      },
    });
    await prisma.tripItem.create({
      data: {
        endsAt: new Date(Date.now() + 3_600_000),
        position: 0,
        startsAt: new Date(),
        tripId: trip.id,
        type: "ACTIVITY",
      },
    });
    await prisma.packingItem.create({
      data: { position: 0, text: "item", tripId: trip.id },
    });
    await prisma.syncMutation.create({
      data: {
        action: "CREATE",
        clientMutationId: `mutation-${userId}`,
        entityType: "TRANSACTION",
        requestHash: "hash",
        status: "APPLIED",
        userId,
      },
    });
    await prisma.deviceCredential.create({
      data: {
        name: "device",
        scopes: ["transaction:draft:create"],
        tokenHash: `device-${userId}`,
        tokenPrefix: "abcd1234",
        userId,
      },
    });
    await prisma.session.create({
      data: {
        expiresAt: new Date(Date.now() + 3_600_000),
        refreshTokenHash: `session-${userId}`,
        userId,
      },
    });
  }

  async function requestDeletion(userUsername: string): Promise<void> {
    const session = await login(userUsername, TEST_PASSWORD);
    await request(app.getHttpServer())
      .post("/api/v1/me/request-deletion")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ password: TEST_PASSWORD, reason: "deletion test" })
      .expect(202);
  }

  async function expireDeletion(userId: string): Promise<void> {
    await prisma.user.update({
      data: {
        deletionLeaseExpiresAt: new Date(Date.now() - 60_000),
        deletionScheduledAt: new Date(Date.now() - 60_000),
      },
      where: { id: userId },
    });
  }

  async function login(userUsername: string, password: string) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ password, username: userUsername });
    expect(response.status).toBe(200);
    return {
      accessToken: response.body.accessToken as string,
    };
  }

  async function occupiedCount(): Promise<number> {
    return prisma.user.count({
      where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
    });
  }

  function username(label: string): string {
    return `o007_${userSequence}_${label}`;
  }
});
