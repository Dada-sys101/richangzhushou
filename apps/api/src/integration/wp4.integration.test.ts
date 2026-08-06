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
const AUGUST = "2026-08";

const describeWithDb = testDatabaseUrl ? describe : describe.skip;

describeWithDb("WP4 shortcuts, drafts, and attachments integration", () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let userSequence = 0;

  beforeAll(async () => {
    if (!testDatabaseUrl) {
      return;
    }
    process.env.DATABASE_URL = testDatabaseUrl;
    delete process.env.FAKE_OCR_TEXT;
    delete process.env.FAKE_SCAN_FAIL;
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
    delete process.env.FAKE_OCR_TEXT;
    delete process.env.FAKE_SCAN_FAIL;
    await app?.close();
    await prisma?.$disconnect();
  });

  it("QA-SC-001/002: idempotent shortcut drafts replay and conflict", async () => {
    const token = await loginNewUser();
    const { plaintextToken } = await createCredential(token, [
      "transaction:draft:create",
    ]);
    const body = {
      amount: "33.00",
      merchant: "星巴克",
      type: "EXPENSE",
    };
    const first = await shortcutDraft(
      plaintextToken,
      "mutation-key-12345678",
      body,
    );
    expect(first.status).toBe(201);
    expect(first.body.draft.status).toBe("PENDING");
    expect(first.body.draft.source).toBe("SHORTCUT");

    const replay = await shortcutDraft(
      plaintextToken,
      "mutation-key-12345678",
      body,
    );
    expect(replay.status).toBe(201);
    expect(replay.body.draft.id).toBe(first.body.draft.id);

    const conflicting = await shortcutDraft(
      plaintextToken,
      "mutation-key-12345678",
      {
        ...body,
        amount: "99.00",
      },
    );
    expect(conflicting.status).toBe(409);
    expect(conflicting.body.code).toBe("IDEMPOTENCY_CONFLICT");

    const list = await request(app.getHttpServer())
      .get("/api/v1/drafts")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].clientMutationId).toBe("mutation-key-12345678");

    const missingKey = await request(app.getHttpServer())
      .post("/api/v1/shortcuts/transaction-drafts")
      .set("Authorization", `Bearer ${plaintextToken}`)
      .send(body);
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.code).toBe("VALIDATION_ERROR");
  });

  it("QA-SC-003: revoked credentials fail immediately", async () => {
    const token = await loginNewUser();
    const { credentialId, plaintextToken } = await createCredential(token, [
      "transaction:draft:create",
    ]);
    const body = { amount: "10.00", type: "EXPENSE" };
    expect(
      (await shortcutDraft(plaintextToken, "key-revoked-test-0001", body))
        .status,
    ).toBe(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/shortcut-credentials/${credentialId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const revoked = await shortcutDraft(
      plaintextToken,
      "key-revoked-test-0002",
      body,
    );
    expect(revoked.status).toBe(401);
    expect(revoked.body.code).toBe("CREDENTIAL_REVOKED");

    const invalid = await request(app.getHttpServer())
      .post("/api/v1/shortcuts/transaction-drafts")
      .set("Authorization", "Bearer da_sc_invalid-token-value")
      .set("Idempotency-Key", "key-revoked-test-0003")
      .send(body);
    expect(invalid.status).toBe(401);
    expect(invalid.body.code).toBe("CREDENTIAL_INVALID");
  });

  it("enforces shortcut scopes and reads today's spend", async () => {
    const token = await loginNewUser();
    const readOnly = await createCredential(token, ["finance:summary:read"]);
    const writeOnly = await createCredential(token, [
      "transaction:draft:create",
    ]);

    const writeDenied = await shortcutDraft(
      readOnly.plaintextToken,
      "key-scope-read-000001",
      { amount: "5.00", type: "EXPENSE" },
    );
    expect(writeDenied.status).toBe(403);
    expect(writeDenied.body.code).toBe("FORBIDDEN");

    const readDenied = await request(app.getHttpServer())
      .get("/api/v1/shortcuts/today-spend")
      .set("Authorization", `Bearer ${writeOnly.plaintextToken}`);
    expect(readDenied.status).toBe(403);

    await createTransaction(token, {
      amount: "12.34",
      occurredAt: new Date().toISOString(),
      type: "EXPENSE",
    });
    const spend = await request(app.getHttpServer())
      .get("/api/v1/shortcuts/today-spend")
      .set("Authorization", `Bearer ${readOnly.plaintextToken}`);
    expect(spend.status).toBe(200);
    expect(spend.body).toMatchObject({
      currency: "CNY",
      todaySpend: "12.34",
    });
    expect(spend.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("QA-DRAFT-002: unconfirmed drafts never enter statistics; confirm creates the record", async () => {
    const token = await loginNewUser();
    const { plaintextToken } = await createCredential(token, [
      "transaction:draft:create",
    ]);
    const created = await shortcutDraft(
      plaintextToken,
      "key-draft-stats-00001",
      {
        amount: "88.00",
        occurredAt: "2026-08-05T04:00:00.000Z",
        type: "EXPENSE",
      },
    );
    const draftId = created.body.draft.id as string;

    const before = await getSummary(token, AUGUST);
    expect(before.body.totalExpense).toBe("0.00");

    const edited = await request(app.getHttpServer())
      .patch(`/api/v1/drafts/${draftId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        payload: {
          amount: "88.00",
          merchant: "星巴克",
          occurredAt: "2026-08-05T04:00:00.000Z",
          type: "EXPENSE",
        },
        version: 1,
      });
    expect(edited.status).toBe(200);
    expect(edited.body.payload.merchant).toBe("星巴克");
    expect(edited.body.version).toBe(2);

    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/drafts/${draftId}/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.draft.status).toBe("CONFIRMED");
    expect(confirmed.body.draft.resultId).toBe(confirmed.body.transaction.id);
    expect(confirmed.body.transaction).toMatchObject({
      amount: "88.00",
      merchant: "星巴克",
      source: "SHORTCUT",
      status: "CONFIRMED",
    });
    const transactionRow = await prisma.transaction.findUniqueOrThrow({
      where: { id: confirmed.body.transaction.id },
    });
    expect(transactionRow.clientMutationId).toBe("key-draft-stats-00001");

    const after = await getSummary(token, AUGUST);
    expect(after.body.totalExpense).toBe("88.00");

    const replay = await request(app.getHttpServer())
      .post(`/api/v1/drafts/${draftId}/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(replay.status).toBe(201);
    expect(replay.body.transaction.id).toBe(confirmed.body.transaction.id);

    const editAfterConfirm = await request(app.getHttpServer())
      .patch(`/api/v1/drafts/${draftId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        payload: { amount: "1.00", type: "EXPENSE" },
        version: 2,
      });
    expect(editAfterConfirm.status).toBe(409);
    expect(editAfterConfirm.body.code).toBe("DRAFT_NOT_EDITABLE");
  });

  it("discards drafts and rejects confirm/discard of settled drafts", async () => {
    const token = await loginNewUser();
    const { plaintextToken } = await createCredential(token, [
      "transaction:draft:create",
    ]);
    const draft = await shortcutDraft(
      plaintextToken,
      "key-draft-discard-0001",
      { amount: "5.00", type: "EXPENSE" },
    );
    const draftId = draft.body.draft.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/drafts/${draftId}/discard`)
      .set("Authorization", `Bearer ${token}`)
      .expect(204);

    const confirmDiscarded = await request(app.getHttpServer())
      .post(`/api/v1/drafts/${draftId}/confirm`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(confirmDiscarded.status).toBe(409);
    expect(confirmDiscarded.body.code).toBe("INVALID_STATE");

    const discardAgain = await request(app.getHttpServer())
      .post(`/api/v1/drafts/${draftId}/discard`)
      .set("Authorization", `Bearer ${token}`);
    expect(discardAgain.status).toBe(409);
  });

  it("QA-DRAFT-001: OCR failure keeps manual entry available; OCR success creates a draft", async () => {
    const token = await loginNewUser();
    delete process.env.FAKE_OCR_TEXT;

    const { attachmentId, uploadToken } = await uploadFlow(token);
    const ocrUnavailable = await request(app.getHttpServer())
      .post("/api/v1/drafts/ocr")
      .set("Authorization", `Bearer ${token}`)
      .send({ attachmentId });
    expect(ocrUnavailable.status).toBe(503);
    expect(ocrUnavailable.body.code).toBe("OCR_UNAVAILABLE");

    const manual = await request(app.getHttpServer())
      .post("/api/v1/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: "9.90", type: "EXPENSE" });
    expect(manual.status).toBe(201);

    process.env.FAKE_OCR_TEXT = "肯德基 25.50";
    const ocrDraft = await request(app.getHttpServer())
      .post("/api/v1/drafts/ocr")
      .set("Authorization", `Bearer ${token}`)
      .send({ attachmentId, clientMutationId: "key-ocr-draft-000001" });
    expect(ocrDraft.status).toBe(201);
    expect(ocrDraft.body.draft.source).toBe("OCR");
    expect(ocrDraft.body.draft.attachmentId).toBe(attachmentId);
    expect(ocrDraft.body.draft.payload).toMatchObject({
      amount: "25.50",
      merchant: "肯德基",
      type: "EXPENSE",
    });

    delete process.env.FAKE_OCR_TEXT;
    void uploadToken;
  });

  it("validates attachment types, size, intent expiry, and scan gating", async () => {
    const token = await loginNewUser();

    const badType = await request(app.getHttpServer())
      .post("/api/v1/attachments/upload-intents")
      .set("Authorization", `Bearer ${token}`)
      .send({ mimeType: "image/gif", ownerType: "TRANSACTION_DRAFT" });
    expect(badType.status).toBe(400);
    expect(badType.body.code).toBe("ATTACHMENT_TYPE_NOT_ALLOWED");

    const intent = await createIntent(token);
    const attachmentId = intent.body.id as string;

    const completeBeforeUpload = await request(app.getHttpServer())
      .post(`/api/v1/attachments/${attachmentId}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(completeBeforeUpload.status).toBe(409);
    expect(completeBeforeUpload.body.code).toBe("ATTACHMENT_NOT_READY");

    const wrongToken = await request(app.getHttpServer())
      .put(`/api/v1/attachments/${attachmentId}/content`)
      .query({ uploadToken: "definitely-not-the-token" })
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.from("fake-image-bytes"));
    expect(wrongToken.status).toBe(401);
    expect(wrongToken.body.code).toBe("UPLOAD_TOKEN_INVALID");

    await uploadContent(attachmentId, intent.body.uploadToken);
    const completed = await request(app.getHttpServer())
      .post(`/api/v1/attachments/${attachmentId}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(completed.status).toBe(200);
    expect(completed.body.attachment.scanStatus).toBe("SCANNED");

    const replayComplete = await request(app.getHttpServer())
      .post(`/api/v1/attachments/${attachmentId}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(replayComplete.status).toBe(200);

    const expired = await createIntent(token);
    await prisma.attachment.update({
      data: { uploadIntentExpiresAt: new Date(Date.now() - 1000) },
      where: { id: expired.body.id },
    });
    const expiredUpload = await request(app.getHttpServer())
      .put(`/api/v1/attachments/${expired.body.id}/content`)
      .query({ uploadToken: expired.body.uploadToken })
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.from("late-bytes"));
    expect(expiredUpload.status).toBe(410);
    expect(expiredUpload.body.code).toBe("UPLOAD_INTENT_EXPIRED");

    const tooLarge = await createIntent(token);
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
    const largeUpload = await request(app.getHttpServer())
      .put(`/api/v1/attachments/${tooLarge.body.id}/content`)
      .query({ uploadToken: tooLarge.body.uploadToken })
      .set("Content-Type", "application/octet-stream")
      .send(largeBuffer);
    expect(largeUpload.status).toBe(413);
    expect(largeUpload.body.code).toBe("ATTACHMENT_TOO_LARGE");
  });

  it("reports attachment scan failures with a structured error", async () => {
    const token = await loginNewUser();
    process.env.FAKE_SCAN_FAIL = "true";
    const intent = await createIntent(token);
    const attachmentId = intent.body.id as string;
    await uploadContent(attachmentId, intent.body.uploadToken);
    const completed = await request(app.getHttpServer())
      .post(`/api/v1/attachments/${attachmentId}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(completed.status).toBe(422);
    expect(completed.body.code).toBe("ATTACHMENT_SCAN_FAILED");

    const row = await prisma.attachment.findUniqueOrThrow({
      where: { id: attachmentId },
    });
    expect(row.scanStatus).toBe("FAILED");
    process.env.FAKE_SCAN_FAIL = "false";
  });

  it("QA-SEC-001 extension: users cannot access each other's drafts, credentials, or attachments", async () => {
    const aToken = await loginNewUser();
    const bToken = await loginNewUser();

    const bCredential = await createCredential(bToken, [
      "transaction:draft:create",
    ]);
    const bDraft = await shortcutDraft(
      bCredential.plaintextToken,
      "key-cross-user-000001",
      { amount: "7.00", type: "EXPENSE" },
    );
    const bAttachment = await createIntent(bToken);
    await uploadContent(bAttachment.body.id, bAttachment.body.uploadToken);

    const checks = [
      ["GET", `/api/v1/drafts/${bDraft.body.draft.id}`],
      ["POST", `/api/v1/drafts/${bDraft.body.draft.id}/confirm`],
      ["POST", `/api/v1/drafts/${bDraft.body.draft.id}/discard`],
      ["DELETE", `/api/v1/shortcut-credentials/${bCredential.credentialId}`],
      ["POST", `/api/v1/attachments/${bAttachment.body.id}/complete`],
      ["DELETE", `/api/v1/attachments/${bAttachment.body.id}`],
    ] as const;
    for (const [method, path] of checks) {
      const response = await sendWithAuth(method, path, aToken);
      expect(response.status).toBe(404);
    }
    const patchCrossUser = await request(app.getHttpServer())
      .patch(`/api/v1/drafts/${bDraft.body.draft.id}`)
      .set("Authorization", `Bearer ${aToken}`)
      .send({ payload: { amount: "1.00", type: "EXPENSE" }, version: 1 });
    expect(patchCrossUser.status).toBe(404);
  });

  it("QA-SEC-002 extension: admins cannot call user content APIs", async () => {
    const admin = await login("admin@example.com", ADMIN_PASSWORD);
    const checks = [
      ["GET", "/api/v1/drafts"],
      ["POST", "/api/v1/drafts/parse-text"],
      ["POST", "/api/v1/drafts/ocr"],
      ["GET", "/api/v1/shortcut-credentials"],
      ["POST", "/api/v1/shortcut-credentials"],
      ["POST", "/api/v1/attachments/upload-intents"],
    ] as const;
    for (const [method, path] of checks) {
      const response = await sendWithAuth(
        method,
        path,
        admin.accessToken,
        method === "POST"
          ? { name: "x", scopes: ["transaction:draft:create"] }
          : undefined,
      );
      expect(response.status).toBe(403);
    }
  });

  it("QA-SEC-003: the database never stores plaintext device or upload tokens", async () => {
    const token = await loginNewUser();
    const { credentialId, plaintextToken } = await createCredential(token, [
      "transaction:draft:create",
      "finance:summary:read",
    ]);
    const credential = await prisma.deviceCredential.findUniqueOrThrow({
      where: { id: credentialId },
    });
    expect(credential.tokenHash).not.toContain(plaintextToken);
    expect(credential.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(credential.tokenPrefix).toBe(plaintextToken.slice(0, 8));
    expect(credential.scopes).toEqual([
      "transaction:draft:create",
      "finance:summary:read",
    ]);

    const intent = await createIntent(token);
    await uploadContent(intent.body.id, intent.body.uploadToken);
    const attachment = await prisma.attachment.findUniqueOrThrow({
      where: { id: intent.body.id },
    });
    expect(attachment.uploadTokenHash).not.toContain(intent.body.uploadToken);
    expect(attachment.uploadTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("QA-DRAFT-003: batch discard requires a second confirmation and writes audit", async () => {
    const token = await loginNewUser();
    const userId = await userIdOf(token);
    const { plaintextToken } = await createCredential(token, [
      "transaction:draft:create",
    ]);
    const first = await shortcutDraft(
      plaintextToken,
      "key-batch-discard-0001",
      { amount: "1.00", type: "EXPENSE" },
    );
    const second = await shortcutDraft(
      plaintextToken,
      "key-batch-discard-0002",
      { amount: "2.00", type: "EXPENSE" },
    );
    const third = await shortcutDraft(
      plaintextToken,
      "key-batch-discard-0003",
      { amount: "3.00", type: "EXPENSE" },
    );

    const intent = await request(app.getHttpServer())
      .post("/api/v1/drafts/batch-discard")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ids: [first.body.draft.id, second.body.draft.id],
        reason: "清理重复草稿",
      });
    expect(intent.status).toBe(200);
    expect(intent.body.affectedDraftIds).toHaveLength(2);

    const invalidConfirm = await request(app.getHttpServer())
      .post("/api/v1/drafts/batch-discard/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({
        confirmationToken: "da_confirm_invalid-token-value-000000000000",
      });
    expect(invalidConfirm.status).toBe(400);
    expect(invalidConfirm.body.code).toBe("CONFIRMATION_TOKEN_INVALID");

    const confirmed = await request(app.getHttpServer())
      .post("/api/v1/drafts/batch-discard/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ confirmationToken: intent.body.confirmationToken });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.discardedCount).toBe(2);

    const list = await request(app.getHttpServer())
      .get("/api/v1/drafts")
      .set("Authorization", `Bearer ${token}`);
    const discarded = list.body.items.filter(
      (item: { status: string }) => item.status === "DISCARDED",
    );
    expect(discarded).toHaveLength(2);
    const pending = list.body.items.filter(
      (item: { status: string }) => item.status === "PENDING",
    );
    expect(pending.map((item: { id: string }) => item.id)).toEqual([
      third.body.draft.id,
    ]);

    const audit = await prisma.adminAudit.findFirst({
      orderBy: { createdAt: "desc" },
      where: { action: "DRAFT_BATCH_DISCARD" },
    });
    expect(audit).toMatchObject({
      actorId: userId,
      reason: "清理重复草稿",
      targetType: "DRAFT",
    });
    expect(audit?.beforeJson).toMatchObject({ pendingCount: 2 });
    expect(audit?.afterJson).toMatchObject({ discardedCount: 2 });

    const replay = await request(app.getHttpServer())
      .post("/api/v1/drafts/batch-discard/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ confirmationToken: intent.body.confirmationToken });
    expect(replay.status).toBe(200);
    expect(replay.body.discardedCount).toBe(0);

    const allPending = await request(app.getHttpServer())
      .post("/api/v1/drafts/batch-discard")
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "清空全部待确认" });
    expect(allPending.status).toBe(200);
    expect(allPending.body.affectedDraftIds).toEqual([third.body.draft.id]);

    const allPendingConfirmed = await request(app.getHttpServer())
      .post("/api/v1/drafts/batch-discard/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ confirmationToken: allPending.body.confirmationToken });
    expect(allPendingConfirmed.status).toBe(200);
    expect(allPendingConfirmed.body.discardedCount).toBe(1);

    const noneLeft = await request(app.getHttpServer())
      .post("/api/v1/drafts/batch-discard")
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "没有草稿" });
    expect(noneLeft.status).toBe(400);
  });

  async function resetDatabase(): Promise<void> {
    await prisma.packingItem.deleteMany();
    await prisma.tripItem.deleteMany();
    await prisma.trip.deleteMany();
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
    const email = `wp4-${userSequence}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    const passwordHash = await hash(TEST_PASSWORD, { type: 2 });
    await prisma.user.create({
      data: {
        displayName: "Draft User",
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

  async function createCredential(token: string, scopes: string[]) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/shortcut-credentials")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `凭证 ${userSequence}`, scopes });
    expect(response.status).toBe(201);
    return {
      credentialId: response.body.credential.id as string,
      plaintextToken: response.body.plaintextToken as string,
    };
  }

  function shortcutDraft(
    token: string,
    key: string,
    body: Record<string, unknown>,
  ) {
    return request(app.getHttpServer())
      .post("/api/v1/shortcuts/transaction-drafts")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key)
      .send(body);
  }

  async function createIntent(token: string) {
    return request(app.getHttpServer())
      .post("/api/v1/attachments/upload-intents")
      .set("Authorization", `Bearer ${token}`)
      .send({ mimeType: "image/png", ownerType: "TRANSACTION_DRAFT" })
      .expect(201);
  }

  async function uploadContent(id: string, uploadToken: string) {
    return request(app.getHttpServer())
      .put(`/api/v1/attachments/${id}/content`)
      .query({ uploadToken })
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.from("fake-image-bytes"))
      .expect(204);
  }

  async function uploadFlow(token: string) {
    const intent = await createIntent(token);
    await uploadContent(intent.body.id, intent.body.uploadToken);
    const completed = await request(app.getHttpServer())
      .post(`/api/v1/attachments/${intent.body.id}/complete`)
      .set("Authorization", `Bearer ${token}`);
    expect(completed.status).toBe(200);
    return {
      attachmentId: intent.body.id as string,
      uploadToken: intent.body.uploadToken as string,
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
