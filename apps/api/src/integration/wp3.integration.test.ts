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

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const TEST_PASSWORD = "UserPassword123!";
const ADMIN_PASSWORD = "AdminPassword123!";
const AUGUST = "2026-08";

const describeWithDb = testDatabaseUrl ? describe : describe.skip;

describeWithDb("WP3 finance integration", () => {
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
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it("QA-FIN-001: 0.10 + 0.20 accumulates without float error", async () => {
    const token = await loginNewUser();

    await createTransaction(token, {
      amount: "0.10",
      occurredAt: "2026-08-05T04:00:00.000Z",
      type: "EXPENSE",
    });
    await createTransaction(token, {
      amount: "0.20",
      occurredAt: "2026-08-05T04:01:00.000Z",
      type: "EXPENSE",
    });

    const summary = await getSummary(token, AUGUST);
    expect(summary.body.totalExpense).toBe("0.30");
    expect(summary.body.netExpense).toBe("0.30");
  });

  it("QA-FIN-002: refund offsets expense and negative amounts are rejected", async () => {
    const token = await loginNewUser();
    const expense = await createTransaction(token, {
      amount: "100.00",
      occurredAt: "2026-08-05T04:00:00.000Z",
      type: "EXPENSE",
    });

    const refund = await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        amount: "20.00",
        occurredAt: "2026-08-05T04:02:00.000Z",
        originalTransactionId: expense.body.transaction.id,
        type: "REFUND",
      });
    expect(refund.status).toBe(201);

    const summary = await getSummary(token, AUGUST);
    expect(summary.body.totalExpense).toBe("100.00");
    expect(summary.body.totalRefund).toBe("20.00");
    expect(summary.body.netExpense).toBe("80.00");

    const negative = await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: "-5.00", type: "EXPENSE" });
    expect(negative.status).toBe(400);
    expect(negative.body.code).toBe("VALIDATION_ERROR");

    const unlinkedMissing = await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: "5.00", type: "REFUND" });
    expect(unlinkedMissing.status).toBe(400);
    expect(unlinkedMissing.body.code).toBe("INVALID_STATE");
  });

  it("QA-FIN-003: soft delete excludes from stats; restore re-includes", async () => {
    const token = await loginNewUser();
    const created = await createTransaction(token, {
      amount: "50.00",
      occurredAt: "2026-08-05T04:00:00.000Z",
      type: "EXPENSE",
    });
    const id = created.body.transaction.id as string;
    expect((await getSummary(token, AUGUST)).body.totalExpense).toBe("50.00");

    await request(app.getHttpServer())
      .delete(`/api/v1/transactions/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    expect((await getSummary(token, AUGUST)).body.totalExpense).toBe("0.00");
    const list = await request(app.getHttpServer())
      .get("/api/v1/transactions")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.items).toHaveLength(0);

    await request(app.getHttpServer())
      .post(`/api/v1/transactions/${id}/restore`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect((await getSummary(token, AUGUST)).body.totalExpense).toBe("50.00");
  });

  it("QA-FIN-004: possible duplicates warn but are never auto-deleted", async () => {
    const token = await loginNewUser();
    await createTransaction(token, {
      amount: "12.34",
      merchant: "星巴克",
      occurredAt: "2026-08-05T04:00:00.000Z",
      type: "EXPENSE",
    });

    const duplicate = await createTransaction(token, {
      amount: "12.34",
      merchant: "星巴克",
      occurredAt: "2026-08-05T04:05:00.000Z",
      type: "EXPENSE",
    });
    expect(duplicate.status).toBe(201);
    expect(duplicate.body.duplicateWarning?.code).toBe("POSSIBLE_DUPLICATE");
    expect(duplicate.body.duplicateWarning?.matchedTransactionId).toBeTruthy();

    const outsideWindow = await createTransaction(token, {
      amount: "12.34",
      merchant: "星巴克",
      occurredAt: "2026-08-05T04:35:00.000Z",
      type: "EXPENSE",
    });
    expect(outsideWindow.body.duplicateWarning).toBeUndefined();

    const differentMerchant = await createTransaction(token, {
      amount: "12.34",
      merchant: "麦当劳",
      occurredAt: "2026-08-05T04:06:00.000Z",
      type: "EXPENSE",
    });
    expect(differentMerchant.body.duplicateWarning).toBeUndefined();

    const fingerprintFirst = await createTransaction(token, {
      amount: "12.34",
      occurredAt: "2026-08-05T04:10:00.000Z",
      sourceFingerprint: "fp-duplicate-123456",
      type: "EXPENSE",
    });
    expect(fingerprintFirst.body.duplicateWarning).toBeUndefined();
    const fingerprintSecond = await createTransaction(token, {
      amount: "12.34",
      occurredAt: "2026-08-05T04:12:00.000Z",
      sourceFingerprint: "fp-duplicate-123456",
      type: "EXPENSE",
    });
    expect(fingerprintSecond.body.duplicateWarning?.code).toBe(
      "POSSIBLE_DUPLICATE",
    );

    const list = await request(app.getHttpServer())
      .get("/api/v1/transactions?limit=100")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.items).toHaveLength(6);
  });

  it("QA-SEC-001: user A cannot read or modify user B's finance data", async () => {
    const aToken = await loginNewUser();
    const bToken = await loginNewUser();

    const bCategory = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${bToken}`)
      .send({ kind: "EXPENSE", name: "B 分类" })
      .expect(201);
    const bAccount = await request(app.getHttpServer())
      .post("/api/v1/financial-accounts")
      .set("Authorization", `Bearer ${bToken}`)
      .send({ kind: "CASH", name: "B 账户" })
      .expect(201);
    const bTransaction = await createTransaction(bToken, {
      amount: "10.00",
      categoryId: bCategory.body.id,
      occurredAt: "2026-08-05T04:00:00.000Z",
      type: "EXPENSE",
    });
    const bBudget = await request(app.getHttpServer())
      .post("/api/v1/budgets")
      .set("Authorization", `Bearer ${bToken}`)
      .send({ amount: "100.00", month: AUGUST })
      .expect(201);

    const txId = bTransaction.body.transaction.id as string;
    const checks = [
      ["GET", `/api/v1/transactions/${txId}`],
      ["PATCH", `/api/v1/transactions/${txId}`],
      ["DELETE", `/api/v1/transactions/${txId}`],
      ["POST", `/api/v1/transactions/${txId}/restore`],
      ["PATCH", `/api/v1/categories/${bCategory.body.id}`],
      ["PATCH", `/api/v1/financial-accounts/${bAccount.body.id}`],
      ["PATCH", `/api/v1/budgets/${bBudget.body.id}`],
      ["DELETE", `/api/v1/budgets/${bBudget.body.id}`],
    ] as const;
    for (const [method, path] of checks) {
      const response = await sendWithAuth(method, path, aToken, { version: 1 });
      expect(response.status).toBe(404);
    }

    const aList = await request(app.getHttpServer())
      .get("/api/v1/transactions")
      .set("Authorization", `Bearer ${aToken}`);
    expect(aList.body.items).toHaveLength(0);

    const refundCrossUser = await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${aToken}`)
      .send({
        amount: "1.00",
        originalTransactionId: txId,
        type: "REFUND",
      });
    expect(refundCrossUser.status).toBe(400);
    expect(refundCrossUser.body.code).toBe("INVALID_STATE");
  });

  it("budgets use the natural month and refunds reduce spend", async () => {
    const token = await loginNewUser();
    await request(app.getHttpServer())
      .post("/api/v1/budgets")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: "1000.00", month: AUGUST })
      .expect(201);

    const category = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ kind: "EXPENSE", name: "餐饮" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/budgets")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: "200.00", categoryId: category.body.id, month: AUGUST })
      .expect(201);

    const expense = await createTransaction(token, {
      amount: "100.00",
      categoryId: category.body.id,
      occurredAt: "2026-08-05T04:00:00.000Z",
      type: "EXPENSE",
    });
    await createTransaction(token, {
      amount: "20.00",
      occurredAt: "2026-08-05T04:02:00.000Z",
      originalTransactionId: expense.body.transaction.id,
      type: "REFUND",
    });

    const duplicate = await request(app.getHttpServer())
      .post("/api/v1/budgets")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: "999.00", month: AUGUST });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("DUPLICATE_RESOURCE");

    const summary = await getSummary(token, AUGUST);
    expect(summary.body.totalExpense).toBe("100.00");
    expect(summary.body.totalRefund).toBe("20.00");
    expect(summary.body.netExpense).toBe("80.00");
    const overall = summary.body.budgets.find(
      (item: { categoryId: string | null }) => item.categoryId === null,
    );
    expect(overall).toMatchObject({
      amount: "1000.00",
      progress: "0.08",
      remaining: "920.00",
      spent: "80.00",
    });
    const categoryBudget = summary.body.budgets.find(
      (item: { categoryId: string | null }) =>
        item.categoryId === category.body.id,
    );
    expect(categoryBudget).toMatchObject({
      amount: "200.00",
      categoryName: "餐饮",
      spent: "100.00",
      remaining: "100.00",
    });
  });

  it("month boundaries follow Asia/Shanghai", async () => {
    const token = await loginNewUser();
    await createTransaction(token, {
      amount: "10.00",
      occurredAt: "2026-07-31T15:59:59.999Z",
      type: "EXPENSE",
    });
    await createTransaction(token, {
      amount: "20.00",
      occurredAt: "2026-07-31T16:00:00.000Z",
      type: "EXPENSE",
    });

    const july = await getSummary(token, "2026-07");
    const august = await getSummary(token, AUGUST);
    expect(july.body.totalExpense).toBe("10.00");
    expect(august.body.totalExpense).toBe("20.00");
  });

  it("exports a user-scoped UTF-8 CSV with a safe filename", async () => {
    const token = await loginNewUser();
    await createTransaction(token, {
      amount: "88.00",
      merchant: "A 的商户",
      occurredAt: "2026-08-05T04:00:00.000Z",
      type: "EXPENSE",
    });

    const exportResponse = await request(app.getHttpServer())
      .get("/api/v1/finance/export.csv?month=2026-08")
      .set("Authorization", `Bearer ${token}`);
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers["content-type"]).toContain("text/csv");
    expect(exportResponse.headers["content-disposition"]).toContain(
      "daily-assistant-transactions-2026-08.csv",
    );
    expect(exportResponse.text.startsWith("\uFEFF")).toBe(true);
    expect(exportResponse.text).toContain("occurredAt");
    expect(exportResponse.text).toContain("A 的商户");
    expect(exportResponse.text).toContain("88.00");

    const otherToken = await loginNewUser();
    const otherExport = await request(app.getHttpServer())
      .get("/api/v1/finance/export.csv?month=2026-08")
      .set("Authorization", `Bearer ${otherToken}`);
    expect(otherExport.text).not.toContain("A 的商户");
  });

  it("idempotent creation replays identical requests and conflicts on changes", async () => {
    const token = await loginNewUser();
    const body = {
      amount: "33.00",
      clientMutationId: "mutation-key-12345678",
      occurredAt: "2026-08-05T04:00:00.000Z",
      type: "EXPENSE",
    };
    const first = await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    expect(first.status).toBe(201);

    const replay = await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    expect(replay.status).toBe(201);
    expect(replay.body.transaction.id).toBe(first.body.transaction.id);

    const conflicting = await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...body, amount: "99.00" });
    expect(conflicting.status).toBe(409);
    expect(conflicting.body.code).toBe("IDEMPOTENCY_CONFLICT");

    const list = await request(app.getHttpServer())
      .get("/api/v1/transactions")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.items).toHaveLength(1);
  });

  it("rejects stale versions and archives categories/accounts", async () => {
    const token = await loginNewUser();
    const category = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ kind: "EXPENSE", name: "交通" })
      .expect(201);

    const stale = await request(app.getHttpServer())
      .patch(`/api/v1/categories/${category.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "改名", version: 99 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe("VERSION_CONFLICT");

    const archived = await request(app.getHttpServer())
      .patch(`/api/v1/categories/${category.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isArchived: true, version: 1 });
    expect(archived.status).toBe(200);
    expect(archived.body.isArchived).toBe(true);

    const activeList = await request(app.getHttpServer())
      .get("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`);
    expect(activeList.body.items).toHaveLength(0);
    const allList = await request(app.getHttpServer())
      .get("/api/v1/categories?includeArchived=true")
      .set("Authorization", `Bearer ${token}`);
    expect(allList.body.items).toHaveLength(1);

    const duplicate = await request(app.getHttpServer())
      .post("/api/v1/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ kind: "EXPENSE", name: "交通" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("DUPLICATE_RESOURCE");
  });

  it("soft-deletes budgets and rejects admin access to user content", async () => {
    const token = await loginNewUser();
    const budget = await request(app.getHttpServer())
      .post("/api/v1/budgets")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: "500.00", month: AUGUST })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/budgets/${budget.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const list = await request(app.getHttpServer())
      .get("/api/v1/budgets")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.items).toHaveLength(0);
    const summary = await getSummary(token, AUGUST);
    expect(summary.body.budgets).toHaveLength(0);

    const admin = await login("admin", ADMIN_PASSWORD);
    for (const path of [
      "/api/v1/transactions",
      "/api/v1/categories",
      "/api/v1/financial-accounts",
      "/api/v1/budgets",
      "/api/v1/finance/summary",
      "/api/v1/finance/export.csv",
    ]) {
      const response = await request(app.getHttpServer())
        .get(path)
        .set("Authorization", `Bearer ${admin.accessToken}`);
      expect(response.status).toBe(403);
    }
    const createResponse = await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ amount: "1.00", type: "EXPENSE" });
    expect(createResponse.status).toBe(403);
  });

  async function resetDatabase(): Promise<void> {
    await prisma.packingItem.deleteMany();
    await prisma.tripItem.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.budget.deleteMany();
    await prisma.financialAccount.deleteMany();
    await prisma.category.deleteMany();
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

  async function loginNewUser(): Promise<string> {
    const username = `wp3_${userSequence}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const passwordHash = await hash(TEST_PASSWORD, { type: 2 });
    await prisma.user.create({
      data: {
        displayName: "Finance User",
        normalizedUsername: username,
        passwordHash,
        role: "USER",
        status: "ACTIVE",
        username,
      },
    });
    return login(username, TEST_PASSWORD).then((result) => result.accessToken);
  }

  async function login(username: string, password: string) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ password, username });
    expect(response.status).toBe(200);
    return {
      accessToken: response.body.accessToken as string,
      cookie: getRefreshCookieHeader(response.headers["set-cookie"]),
    };
  }

  async function createTransaction(
    token: string,
    body: Record<string, unknown>,
  ) {
    return request(app.getHttpServer())
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  async function getSummary(token: string, month: string) {
    return request(app.getHttpServer())
      .get(`/api/v1/finance/summary?month=${month}`)
      .set("Authorization", `Bearer ${token}`);
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
