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

describeWithDb(
  "WP7 offline sync: change stream, idempotent mutations, and conflicts",
  () => {
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

    it("QA-SYNC-002 + BR-SYNC-001/002: replay creates a single server record and different content conflicts", async () => {
      const token = await loginNewUser();
      const mutation = {
        clientMutationId: "sync-tx-key-00000001",
        entityType: "TRANSACTION",
        action: "CREATE",
        payload: {
          amount: "12.30",
          occurredAt: "2026-08-06T04:00:00.000Z",
          type: "EXPENSE",
        },
      };

      const first = await postMutations(token, [mutation]);
      expect(first.status).toBe(200);
      expect(first.body.results[0].status).toBe("OK");
      const transactionId = first.body.results[0].result.id as string;
      expect(first.body.results[0].result.amount).toBe("12.30");

      const replay = await postMutations(token, [mutation]);
      expect(replay.status).toBe(200);
      expect(replay.body.results[0].status).toBe("OK");
      expect(replay.body.results[0].result.id).toBe(transactionId);

      const conflict = await postMutations(token, [
        { ...mutation, payload: { ...mutation.payload, amount: "99.00" } },
      ]);
      expect(conflict.status).toBe(200);
      expect(conflict.body.results[0].status).toBe("ERROR");
      expect(conflict.body.results[0].error.code).toBe("IDEMPOTENCY_CONFLICT");

      const count = await prisma.transaction.count({
        where: { clientMutationId: mutation.clientMutationId },
      });
      expect(count).toBe(1);
    });

    it("change stream returns create/update/tombstone with monotonic pagination and invalid cursor errors", async () => {
      const token = await loginNewUser();

      const created = await createTransaction(token, {
        amount: "10.00",
        clientMutationId: "sync-stream-tx-00001",
        type: "EXPENSE",
      });
      expect(created.status).toBe(201);
      const transactionId = created.body.transaction.id as string;

      await request(app.getHttpServer())
        .post("/api/v1/calendar-events")
        .set("Authorization", `Bearer ${token}`)
        .send({
          endsAt: "2026-08-06T05:00:00.000Z",
          startsAt: "2026-08-06T04:30:00.000Z",
          title: "同步日历",
        })
        .expect(201);

      const firstPage = await request(app.getHttpServer())
        .get("/api/v1/sync/changes?limit=1")
        .set("Authorization", `Bearer ${token}`);
      expect(firstPage.status).toBe(200);
      expect(firstPage.body.changes).toHaveLength(1);
      expect(firstPage.body.changes[0].changeType).toBe("CREATE");
      expect(firstPage.body.nextCursor).toBeTruthy();

      const secondPage = await request(app.getHttpServer())
        .get(
          `/api/v1/sync/changes?limit=10&cursor=${encodeURIComponent(
            firstPage.body.nextCursor as string,
          )}`,
        )
        .set("Authorization", `Bearer ${token}`);
      expect(secondPage.status).toBe(200);
      expect(secondPage.body.changes).toHaveLength(1);
      expect(secondPage.body.nextCursor).toBeNull();
      const ids = [
        firstPage.body.changes[0].entityId,
        secondPage.body.changes[0].entityId,
      ];
      expect(ids).toContain(transactionId);

      await request(app.getHttpServer())
        .patch(`/api/v1/transactions/${transactionId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: "11.00", version: 1 })
        .expect(200);
      const afterUpdate = await request(app.getHttpServer())
        .get(
          `/api/v1/sync/changes?limit=10&cursor=${encodeURIComponent(
            firstPage.body.nextCursor as string,
          )}`,
        )
        .set("Authorization", `Bearer ${token}`);
      expect(afterUpdate.status).toBe(200);
      const updateChange = afterUpdate.body.changes.find(
        (change: { entityId: string }) => change.entityId === transactionId,
      );
      expect(updateChange).toBeDefined();
      expect(updateChange.changeType).toBe("UPDATE");
      expect(updateChange.data.amount).toBe("11.00");

      await request(app.getHttpServer())
        .delete(`/api/v1/transactions/${transactionId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);
      const afterDelete = await request(app.getHttpServer())
        .get(
          `/api/v1/sync/changes?limit=10&cursor=${encodeURIComponent(
            firstPage.body.nextCursor as string,
          )}`,
        )
        .set("Authorization", `Bearer ${token}`);
      const deleteChange = afterDelete.body.changes.find(
        (change: { entityId: string }) => change.entityId === transactionId,
      );
      expect(deleteChange.changeType).toBe("DELETE");
      expect(deleteChange.deletedAt).toBeTruthy();

      const badCursor = await request(app.getHttpServer())
        .get("/api/v1/sync/changes?cursor=not-a-valid-cursor")
        .set("Authorization", `Bearer ${token}`);
      expect(badCursor.status).toBe(400);
      expect(badCursor.body.code).toBe("CURSOR_INVALID");
    });

    it("QA-SYNC-003: stale updates and deletes return version conflicts with the server entity", async () => {
      const token = await loginNewUser();
      const created = await createTransaction(token, {
        amount: "5.00",
        clientMutationId: "sync-conflict-tx-0001",
        type: "EXPENSE",
      });
      const transactionId = created.body.transaction.id as string;

      // Device A edits the amount online.
      const deviceA = await request(app.getHttpServer())
        .patch(`/api/v1/transactions/${transactionId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: "20.00", version: 1 });
      expect(deviceA.status).toBe(200);
      expect(deviceA.body.transaction.version).toBe(2);

      // Device B replays a stale offline update.
      const stale = await postMutations(token, [
        {
          clientMutationId: "sync-conflict-tx-0002",
          entityType: "TRANSACTION",
          action: "UPDATE",
          entityId: transactionId,
          version: 1,
          payload: { amount: "30.00" },
        },
      ]);
      expect(stale.status).toBe(200);
      expect(stale.body.results[0].status).toBe("ERROR");
      expect(stale.body.results[0].error.code).toBe("VERSION_CONFLICT");
      expect(stale.body.results[0].error.current.data.amount).toBe("20.00");

      const retry = await postMutations(token, [
        {
          clientMutationId: "sync-conflict-tx-0003",
          entityType: "TRANSACTION",
          action: "UPDATE",
          entityId: transactionId,
          version: 2,
          payload: { amount: "30.00" },
        },
      ]);
      expect(retry.body.results[0].status).toBe("OK");
      expect(retry.body.results[0].result.amount).toBe("30.00");
      expect(retry.body.results[0].result.version).toBe(3);

      // A stale delete must not silently win either.
      const staleDelete = await postMutations(token, [
        {
          clientMutationId: "sync-conflict-tx-0004",
          entityType: "TRANSACTION",
          action: "DELETE",
          entityId: transactionId,
          version: 2,
        },
      ]);
      expect(staleDelete.body.results[0].status).toBe("ERROR");
      expect(staleDelete.body.results[0].error.code).toBe("VERSION_CONFLICT");

      const deleteNow = await postMutations(token, [
        {
          clientMutationId: "sync-conflict-tx-0005",
          entityType: "TRANSACTION",
          action: "DELETE",
          entityId: transactionId,
          version: 3,
        },
      ]);
      expect(deleteNow.body.results[0].status).toBe("OK");
      expect(deleteNow.body.results[0].result.deletedAt).toBeTruthy();

      const restore = await postMutations(token, [
        {
          clientMutationId: "sync-conflict-tx-0006",
          entityType: "TRANSACTION",
          action: "RESTORE",
          entityId: transactionId,
          version: 4,
        },
      ]);
      expect(restore.body.results[0].status).toBe("OK");
      expect(restore.body.results[0].result.deletedAt).toBeNull();
    });

    it("rejects oversized batches and unsupported entity/action combinations", async () => {
      const token = await loginNewUser();
      const tooMany = await postMutations(
        token,
        Array.from({ length: 51 }, (_, index) => ({
          action: "CREATE" as const,
          clientMutationId: `sync-batch-key-${String(index).padStart(4, "0")}`,
          entityType: "TASK" as const,
          payload: { title: `任务 ${index}` },
        })),
      );
      expect(tooMany.status).toBe(400);
      expect(tooMany.body.code).toBe("MUTATION_BATCH_TOO_LARGE");

      const unsupported = await postMutations(token, [
        {
          clientMutationId: "sync-cat-del-000001",
          entityType: "CATEGORY",
          action: "DELETE",
          entityId: "missing",
          version: 1,
        },
      ]);
      expect(unsupported.status).toBe(200);
      expect(unsupported.body.results[0].status).toBe("ERROR");
      expect(unsupported.body.results[0].error.code).toBe(
        "MUTATION_UNSUPPORTED",
      );
    });

    it("supports idempotent category, account, and budget creates through sync", async () => {
      const token = await loginNewUser();
      const category = {
        clientMutationId: "sync-cat-create-0001",
        entityType: "CATEGORY",
        action: "CREATE",
        payload: { kind: "EXPENSE", name: "餐饮" },
      };
      const first = await postMutations(token, [category]);
      expect(first.body.results[0].status).toBe("OK");
      const categoryId = first.body.results[0].result.id as string;
      const replay = await postMutations(token, [category]);
      expect(replay.body.results[0].result.id).toBe(categoryId);
      const different = await postMutations(token, [
        { ...category, payload: { kind: "EXPENSE", name: "交通" } },
      ]);
      expect(different.body.results[0].error.code).toBe("IDEMPOTENCY_CONFLICT");

      const account = {
        clientMutationId: "sync-acc-create-0001",
        entityType: "FINANCIAL_ACCOUNT",
        action: "CREATE",
        payload: { kind: "CASH", name: "现金" },
      };
      const accountFirst = await postMutations(token, [account]);
      expect(accountFirst.body.results[0].status).toBe("OK");
      const accountReplay = await postMutations(token, [account]);
      expect(accountReplay.body.results[0].result.id).toBe(
        accountFirst.body.results[0].result.id,
      );

      const budget = {
        clientMutationId: "sync-bud-create-0001",
        entityType: "BUDGET",
        action: "CREATE",
        payload: { amount: "800.00", month: "2026-08" },
      };
      const budgetFirst = await postMutations(token, [budget]);
      expect(budgetFirst.body.results[0].status).toBe("OK");
      const budgetReplay = await postMutations(token, [budget]);
      expect(budgetReplay.body.results[0].result.id).toBe(
        budgetFirst.body.results[0].result.id,
      );
    });

    it("syncs draft create, update, and discard as a tombstone", async () => {
      const token = await loginNewUser();
      const create = await postMutations(token, [
        {
          clientMutationId: "sync-draft-create-001",
          entityType: "DRAFT_RECORD",
          action: "CREATE",
          payload: {
            source: "MANUAL",
            targetType: "TRANSACTION",
            payload: {
              amount: "9.99",
              occurredAt: "2026-08-06T04:00:00.000Z",
              type: "EXPENSE",
            },
          },
        },
      ]);
      expect(create.body.results[0].status).toBe("OK");
      const draftId = create.body.results[0].result.id as string;
      expect(create.body.results[0].result.status).toBe("PENDING");

      const update = await postMutations(token, [
        {
          clientMutationId: "sync-draft-update-001",
          entityType: "DRAFT_RECORD",
          action: "UPDATE",
          entityId: draftId,
          version: 1,
          payload: {
            payload: {
              amount: "9.99",
              occurredAt: "2026-08-06T04:00:00.000Z",
              note: "同步备注",
              type: "EXPENSE",
            },
          },
        },
      ]);
      expect(update.body.results[0].status).toBe("OK");
      expect(update.body.results[0].result.version).toBe(2);

      const discard = await postMutations(token, [
        {
          clientMutationId: "sync-draft-discard-001",
          entityType: "DRAFT_RECORD",
          action: "DELETE",
          entityId: draftId,
          version: 2,
        },
      ]);
      expect(discard.body.results[0].status).toBe("OK");
      expect(discard.body.results[0].result.status).toBe("DISCARDED");

      const changes = await request(app.getHttpServer())
        .get("/api/v1/sync/changes?limit=20")
        .set("Authorization", `Bearer ${token}`);
      const draftChanges = changes.body.changes.filter(
        (change: { entityId: string }) => change.entityId === draftId,
      );
      const lastDraftChange = draftChanges[draftChanges.length - 1];
      expect(lastDraftChange.changeType).toBe("DELETE");
    });

    it("QA-SEC-001/002: isolates users, forbids admins, and reports status counts", async () => {
      const aToken = await loginNewUser();
      const bToken = await loginNewUser();

      await postMutations(aToken, [
        {
          clientMutationId: "sync-sec-tx-000001",
          entityType: "TRANSACTION",
          action: "CREATE",
          payload: {
            amount: "1.00",
            occurredAt: "2026-08-06T04:00:00.000Z",
            type: "EXPENSE",
          },
        },
      ]);
      const changes = await request(app.getHttpServer())
        .get("/api/v1/sync/changes")
        .set("Authorization", `Bearer ${bToken}`);
      expect(changes.status).toBe(200);
      expect(changes.body.changes).toHaveLength(0);

      const crossUpdate = await postMutations(bToken, [
        {
          clientMutationId: "sync-sec-tx-000002",
          entityType: "TRANSACTION",
          action: "UPDATE",
          entityId: "does-not-belong",
          version: 1,
          payload: { amount: "2.00" },
        },
      ]);
      expect(crossUpdate.body.results[0].status).toBe("ERROR");
      expect(crossUpdate.body.results[0].error.code).toBe("RESOURCE_NOT_FOUND");

      const admin = await login("admin@example.com", ADMIN_PASSWORD);
      for (const path of [
        "/api/v1/sync/changes",
        "/api/v1/sync/status",
        "/api/v1/sync/mutations",
      ]) {
        const response = await request(app.getHttpServer())
          [path.endsWith("/mutations") ? "post" : "get"](path)
          .set("Authorization", `Bearer ${admin.accessToken}`)
          .send(path.endsWith("/mutations") ? { mutations: [] } : undefined);
        expect(response.status).toBe(403);
      }

      const status = await request(app.getHttpServer())
        .get("/api/v1/sync/status")
        .set("Authorization", `Bearer ${aToken}`);
      expect(status.status).toBe(200);
      expect(status.body.appliedCount).toBeGreaterThanOrEqual(1);
      expect(status.body.failedCount).toBeGreaterThanOrEqual(0);
      expect(status.body.conflictCount).toBeGreaterThanOrEqual(0);
      expect(status.body.lastAppliedAt).toBeTruthy();
    });

    it("rate limits the sync endpoints", async () => {
      const token = await loginNewUser();
      let lastStatus = 200;
      for (let index = 0; index < 121; index += 1) {
        const response = await request(app.getHttpServer())
          .get("/api/v1/sync/changes")
          .set("Authorization", `Bearer ${token}`);
        lastStatus = response.status;
      }
      expect(lastStatus).toBe(429);
    });

    async function resetDatabase(): Promise<void> {
      await prisma.syncMutation.deleteMany();
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
      const email = `wp7-${userSequence}-${Math.random()
        .toString(36)
        .slice(2, 8)}@example.com`;
      const passwordHash = await hash(TEST_PASSWORD, { type: 2 });
      await prisma.user.create({
        data: {
          displayName: "Sync User",
          email,
          normalizedEmail: email,
          passwordHash,
          role: "USER",
          status: "ACTIVE",
        },
      });
      return login(email, TEST_PASSWORD).then((result) => result.accessToken);
    }

    async function login(email: string, password: string) {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password });
      expect(response.status).toBe(200);
      return { accessToken: response.body.accessToken as string };
    }

    function postMutations(
      token: string,
      mutations: Array<Record<string, unknown>>,
    ) {
      return request(app.getHttpServer())
        .post("/api/v1/sync/mutations")
        .set("Authorization", `Bearer ${token}`)
        .send({ mutations });
    }

    function createTransaction(token: string, body: Record<string, unknown>) {
      return request(app.getHttpServer())
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${token}`)
        .send(body);
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
  },
);
