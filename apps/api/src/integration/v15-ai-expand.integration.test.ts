import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  PrismaClient,
  type AiOperationStatus,
  type AiOperationType,
  type AiProposalStatus,
  type AiProviderAttemptStatus,
  type AiRequestStatus,
} from "../generated/prisma/client.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDb = testDatabaseUrl ? describe : describe.skip;

interface ColumnInfo {
  columnName: string;
  columnType: string;
  columnDefault: string | null;
  isNullable: string;
  tableName: string;
}

interface ForeignKeyInfo {
  columnName: string;
  constraintName: string;
  referencedTableName: string;
  tableName: string;
}

describeWithDb("V1.5 PR2 AI DB expand schema", () => {
  let prisma: PrismaClient;
  const usernamePrefix = "v15_ai_";

  beforeAll(() => {
    if (!testDatabaseUrl) {
      return;
    }
    prisma = new PrismaClient({
      adapter: new PrismaMariaDb(testDatabaseUrl),
    });
  });

  beforeEach(async () => {
    if (!prisma) {
      return;
    }
    await prisma.user.deleteMany({
      where: { username: { startsWith: usernamePrefix } },
    });
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }
    await prisma.user.deleteMany({
      where: { username: { startsWith: usernamePrefix } },
    });
    await prisma.$disconnect();
  });

  it("creates exactly the four AI tables with frozen column types, nullability, and enums", async () => {
    const tables = await prisma.$queryRaw<Array<{ tableName: string }>>`
      SELECT TABLE_NAME AS tableName
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'ai_requests',
          'ai_proposals',
          'ai_operations',
          'ai_provider_attempts'
        )
      ORDER BY TABLE_NAME
    `;
    expect(tables.map((row) => row.tableName)).toEqual([
      "ai_operations",
      "ai_proposals",
      "ai_provider_attempts",
      "ai_requests",
    ]);

    const columns = await prisma.$queryRaw<ColumnInfo[]>`
      SELECT
        TABLE_NAME AS tableName,
        COLUMN_NAME AS columnName,
        COLUMN_TYPE AS columnType,
        COLUMN_DEFAULT AS columnDefault,
        IS_NULLABLE AS isNullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'ai_requests',
          'ai_proposals',
          'ai_operations',
          'ai_provider_attempts'
        )
    `;
    const byColumn = new Map(
      columns.map((row) => [`${row.tableName}.${row.columnName}`, row]),
    );

    const expectColumn = (
      table: string,
      column: string,
      columnType: string,
      nullable: boolean,
      defaultValue: string | null = null,
    ) => {
      const info = byColumn.get(`${table}.${column}`);
      expect(info, `${table}.${column}`).toBeDefined();
      expect(info?.columnType, `${table}.${column} type`).toBe(columnType);
      expect(info?.isNullable, `${table}.${column} nullability`).toBe(
        nullable ? "YES" : "NO",
      );
      expect(info?.columnDefault, `${table}.${column} default`).toBe(
        defaultValue,
      );
    };

    // AiRequest
    expectColumn("ai_requests", "id", "varchar(191)", false);
    expectColumn("ai_requests", "user_id", "varchar(191)", false);
    expectColumn("ai_requests", "request_id", "varchar(100)", false);
    expectColumn("ai_requests", "idempotency_key", "varchar(200)", false);
    expectColumn("ai_requests", "input_fingerprint", "char(64)", false);
    expectColumn("ai_requests", "locale", "varchar(20)", false);
    expectColumn("ai_requests", "time_zone_id", "varchar(64)", false);
    expectColumn("ai_requests", "proposal_id", "varchar(191)", true);
    expectColumn("ai_requests", "failure_category", "varchar(50)", true);
    expectColumn("ai_requests", "failure_code", "varchar(100)", true);
    expectColumn("ai_requests", "started_at", "datetime(3)", true);
    expectColumn("ai_requests", "completed_at", "datetime(3)", true);
    expectColumn(
      "ai_requests",
      "created_at",
      "datetime(3)",
      false,
      "CURRENT_TIMESTAMP(3)",
    );
    expectColumn("ai_requests", "updated_at", "datetime(3)", false);
    const requestStatusType =
      byColumn.get("ai_requests.status")?.columnType ?? "";
    for (const value of [
      "CLAIMED",
      "RUNNING",
      "SUCCEEDED",
      "FAILED",
      "CANCELLED",
    ]) {
      expect(requestStatusType).toContain(`'${value}'`);
    }

    // AiProposal
    expectColumn("ai_proposals", "ai_request_id", "varchar(191)", false);
    expectColumn("ai_proposals", "source_draft_id", "varchar(191)", true);
    expectColumn("ai_proposals", "provider_id", "varchar(80)", false);
    expectColumn("ai_proposals", "model_id", "varchar(120)", false);
    expectColumn("ai_proposals", "schema_version", "smallint", false);
    expectColumn("ai_proposals", "response_fingerprint", "char(64)", false);
    expectColumn("ai_proposals", "usage_json", "json", true);
    expectColumn("ai_proposals", "expires_at", "datetime(3)", true);
    expectColumn("ai_proposals", "reviewed_at", "datetime(3)", true);
    expectColumn("ai_proposals", "completed_at", "datetime(3)", true);
    expectColumn("ai_proposals", "version", "int", false, "1");
    expectColumn(
      "ai_proposals",
      "created_at",
      "datetime(3)",
      false,
      "CURRENT_TIMESTAMP(3)",
    );
    expectColumn("ai_proposals", "updated_at", "datetime(3)", false);
    const proposalStatusType =
      byColumn.get("ai_proposals.status")?.columnType ?? "";
    for (const value of [
      "PENDING_REVIEW",
      "PARTIALLY_APPLIED",
      "APPLIED",
      "REJECTED",
      "EXPIRED",
      "FAILED",
      "CANCELLED",
    ]) {
      expect(proposalStatusType).toContain(`'${value}'`);
    }

    // AiOperation
    expectColumn("ai_operations", "proposal_id", "varchar(191)", false);
    expectColumn("ai_operations", "ordinal", "smallint", false);
    expectColumn("ai_operations", "confidence", "decimal(5,4)", false);
    expectColumn("ai_operations", "fields_json", "json", false);
    expectColumn("ai_operations", "fields_fingerprint", "char(64)", false);
    expectColumn("ai_operations", "clarification", "varchar(500)", true);
    expectColumn("ai_operations", "result_entity_type", "varchar(50)", true);
    expectColumn("ai_operations", "result_entity_id", "varchar(191)", true);
    expectColumn("ai_operations", "result_draft_id", "varchar(191)", true);
    expectColumn("ai_operations", "error_code", "varchar(100)", true);
    expectColumn("ai_operations", "error_message", "varchar(500)", true);
    expectColumn("ai_operations", "accepted_at", "datetime(3)", true);
    expectColumn("ai_operations", "rejected_at", "datetime(3)", true);
    expectColumn("ai_operations", "applied_at", "datetime(3)", true);
    expectColumn(
      "ai_operations",
      "created_at",
      "datetime(3)",
      false,
      "CURRENT_TIMESTAMP(3)",
    );
    expectColumn("ai_operations", "updated_at", "datetime(3)", false);
    const operationType =
      byColumn.get("ai_operations.operation_type")?.columnType ?? "";
    for (const value of [
      "TRANSACTION",
      "CALENDAR_EVENT",
      "TASK",
      "REMINDER",
      "TRIP",
    ]) {
      expect(operationType).toContain(`'${value}'`);
    }
    const operationStatusType =
      byColumn.get("ai_operations.status")?.columnType ?? "";
    for (const value of [
      "PENDING",
      "ACCEPTED",
      "REJECTED",
      "APPLIED",
      "FAILED",
      "EXPIRED",
    ]) {
      expect(operationStatusType).toContain(`'${value}'`);
    }

    // AiProviderAttempt
    expectColumn(
      "ai_provider_attempts",
      "ai_request_id",
      "varchar(191)",
      false,
    );
    expectColumn("ai_provider_attempts", "attempt_no", "smallint", false);
    expectColumn("ai_provider_attempts", "provider_id", "varchar(80)", false);
    expectColumn("ai_provider_attempts", "model_id", "varchar(120)", true);
    expectColumn(
      "ai_provider_attempts",
      "failure_category",
      "varchar(50)",
      true,
    );
    expectColumn("ai_provider_attempts", "http_status", "smallint", true);
    expectColumn("ai_provider_attempts", "latency_ms", "int", true);
    expectColumn("ai_provider_attempts", "input_tokens", "int", true);
    expectColumn("ai_provider_attempts", "output_tokens", "int", true);
    expectColumn("ai_provider_attempts", "started_at", "datetime(3)", false);
    expectColumn("ai_provider_attempts", "completed_at", "datetime(3)", true);
    const attemptStatusType =
      byColumn.get("ai_provider_attempts.status")?.columnType ?? "";
    for (const value of ["RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]) {
      expect(attemptStatusType).toContain(`'${value}'`);
    }
  });

  it("enforces the four uniqueness invariants", async () => {
    const user = await createUser();
    const request = await createRequest(user.id, "uniq-req-1", "CLAIMED");
    const proposal = await createProposal(user.id, request.id, null);

    await expect(
      createRequest(user.id, "uniq-req-2", "CLAIMED", request.idempotencyKey),
    ).rejects.toMatchObject({ code: "P2002" });

    await expect(
      createProposal(user.id, request.id, null),
    ).rejects.toMatchObject({ code: "P2002" });

    await createOperation(proposal.id, 0);
    await expect(createOperation(proposal.id, 0)).rejects.toMatchObject({
      code: "P2002",
    });

    await createAttempt(request.id, 1);
    await expect(createAttempt(request.id, 1)).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("cascades Request → Proposal → Operation and Request → Attempt deletes", async () => {
    const user = await createUser();
    const request = await createRequest(user.id, "cascade-req-1", "SUCCEEDED");
    const proposal = await createProposal(user.id, request.id, null);
    const operation = await createOperation(proposal.id, 0);
    const attempt = await createAttempt(request.id, 1);

    await prisma.aiRequest.delete({ where: { id: request.id } });

    expect(
      await prisma.aiProposal.findUnique({ where: { id: proposal.id } }),
    ).toBeNull();
    expect(
      await prisma.aiOperation.findUnique({ where: { id: operation.id } }),
    ).toBeNull();
    expect(
      await prisma.aiProviderAttempt.findUnique({ where: { id: attempt.id } }),
    ).toBeNull();
    expect(
      await prisma.user.findUnique({ where: { id: user.id } }),
    ).not.toBeNull();
  });

  it("cascades User hard delete across all four AI tables", async () => {
    const user = await createUser();
    const request = await createRequest(user.id, "user-cascade-1", "FAILED");
    const proposal = await createProposal(user.id, request.id, null);
    await createOperation(proposal.id, 0);
    await createAttempt(request.id, 1);

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.aiRequest.count({ where: { userId: user.id } })).toBe(
      0,
    );
    expect(await prisma.aiProposal.count({ where: { userId: user.id } })).toBe(
      0,
    );
    expect(await prisma.aiOperation.count()).toBe(0);
    expect(await prisma.aiProviderAttempt.count()).toBe(0);
  });

  it("sets both DraftRecord references to NULL while keeping AI rows and the Draft independent", async () => {
    const user = await createUser();
    const draft = await prisma.draftRecord.create({
      data: {
        payloadJson: { amount: "1.00", type: "EXPENSE" },
        source: "MANUAL",
        status: "PENDING",
        targetType: "TRANSACTION",
        userId: user.id,
      },
    });
    const request = await createRequest(user.id, "set-null-req-1", "SUCCEEDED");
    const proposal = await prisma.aiProposal.create({
      data: {
        aiRequestId: request.id,
        modelId: "deepseek-v4-flash",
        providerId: "deepseek",
        responseFingerprint: "a".repeat(64),
        schemaVersion: 1,
        sourceDraftId: draft.id,
        status: "PENDING_REVIEW",
        userId: user.id,
      },
    });
    const operation = await prisma.aiOperation.create({
      data: {
        confidence: "0.95",
        fieldsFingerprint: "b".repeat(64),
        fieldsJson: { amount: "1.00", type: "EXPENSE" },
        operationType: "TRANSACTION",
        ordinal: 0,
        proposalId: proposal.id,
        resultDraftId: draft.id,
        status: "PENDING",
      },
    });

    await prisma.draftRecord.delete({ where: { id: draft.id } });

    const loadedProposal = await prisma.aiProposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    const loadedOperation = await prisma.aiOperation.findUniqueOrThrow({
      where: { id: operation.id },
    });
    expect(loadedProposal.sourceDraftId).toBeNull();
    expect(loadedOperation.resultDraftId).toBeNull();

    await prisma.aiProposal.delete({ where: { id: proposal.id } });
    expect(await prisma.draftRecord.count()).toBe(0);
  });

  it("keeps AiProposal independent of DraftRecord and persists Proposal content fields", async () => {
    const user = await createUser();
    const request = await createRequest(user.id, "no-draft-req-1", "SUCCEEDED");
    const proposal = await createProposal(user.id, request.id, null);
    await prisma.aiOperation.create({
      data: {
        clarification: "Please confirm the merchant name",
        confidence: "0.60",
        fieldsFingerprint: "c".repeat(64),
        fieldsJson: { amount: "5.00", type: "EXPENSE" },
        operationType: "TRANSACTION",
        ordinal: 0,
        proposalId: proposal.id,
        status: "PENDING",
      },
    });

    const loadedProposal = await prisma.aiProposal.findUniqueOrThrow({
      include: { operations: true },
      where: { id: proposal.id },
    });
    expect(loadedProposal.sourceDraftId).toBeNull();
    expect(loadedProposal.operations).toHaveLength(1);
    const loadedOperation = loadedProposal.operations[0]!;
    expect(loadedOperation.fieldsJson).toEqual({
      amount: "5.00",
      type: "EXPENSE",
    });
    expect(loadedOperation.clarification).toBe(
      "Please confirm the merchant name",
    );
    expect(loadedOperation.resultDraftId).toBeNull();
    expect(await prisma.draftRecord.count()).toBe(0);
  });

  it("rolls back AI rows inside an aborted transaction", async () => {
    const user = await createUser();
    await expect(
      prisma.$transaction(async (tx) => {
        const request = await tx.aiRequest.create({
          data: {
            idempotencyKey: "rollback-idem-1",
            inputFingerprint: "d".repeat(64),
            locale: "zh-CN",
            requestId: "rollback-request-1",
            status: "CLAIMED",
            timeZoneId: "Asia/Shanghai",
            userId: user.id,
          },
        });
        await tx.aiProposal.create({
          data: {
            aiRequestId: request.id,
            modelId: "deepseek-v4-flash",
            providerId: "deepseek",
            responseFingerprint: "e".repeat(64),
            schemaVersion: 1,
            status: "PENDING_REVIEW",
            userId: user.id,
          },
        });
        throw new Error("abort ai transaction");
      }),
    ).rejects.toThrow("abort ai transaction");

    expect(await prisma.aiRequest.count({ where: { userId: user.id } })).toBe(
      0,
    );
    expect(await prisma.aiProposal.count({ where: { userId: user.id } })).toBe(
      0,
    );
  });

  it("lets exactly one concurrent duplicate idempotency key win", async () => {
    const user = await createUser();
    const idempotencyKey = "concurrent-idem-key";
    const [first, second] = await Promise.allSettled([
      createRequest(user.id, "concurrent-req-a", "CLAIMED", idempotencyKey),
      createRequest(user.id, "concurrent-req-b", "CLAIMED", idempotencyKey),
    ]);

    expect(first.status).toBe("fulfilled");
    expect(second.status).toBe("rejected");
    expect((second as PromiseRejectedResult).reason).toMatchObject({
      code: "P2002",
    });
    expect(await prisma.aiRequest.count({ where: { userId: user.id } })).toBe(
      1,
    );
  });

  it("lets exactly one concurrent duplicate (proposalId, ordinal) win", async () => {
    const user = await createUser();
    const request = await createRequest(
      user.id,
      "concurrent-op-req-1",
      "SUCCEEDED",
    );
    const proposal = await createProposal(user.id, request.id, null);
    const [first, second] = await Promise.allSettled([
      createOperation(proposal.id, 0),
      createOperation(proposal.id, 0),
    ]);

    expect(first.status).toBe("fulfilled");
    expect(second.status).toBe("rejected");
    expect((second as PromiseRejectedResult).reason).toMatchObject({
      code: "P2002",
    });
    expect(
      await prisma.aiOperation.count({ where: { proposalId: proposal.id } }),
    ).toBe(1);
  });

  it("lets exactly one concurrent duplicate (aiRequestId, attemptNo) win", async () => {
    const user = await createUser();
    const request = await createRequest(
      user.id,
      "concurrent-att-req-1",
      "RUNNING",
    );
    const [first, second] = await Promise.allSettled([
      createAttempt(request.id, 1),
      createAttempt(request.id, 1),
    ]);

    expect(first.status).toBe("fulfilled");
    expect(second.status).toBe("rejected");
    expect((second as PromiseRejectedResult).reason).toMatchObject({
      code: "P2002",
    });
    expect(
      await prisma.aiProviderAttempt.count({
        where: { aiRequestId: request.id },
      }),
    ).toBe(1);
  });

  it("keeps attempt metadata-only and the request proposalId a logical scalar without a circular FK", async () => {
    const columns = await prisma.$queryRaw<ColumnInfo[]>`
      SELECT
        TABLE_NAME AS tableName,
        COLUMN_NAME AS columnName
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('ai_requests', 'ai_proposals', 'ai_operations', 'ai_provider_attempts')
    `;
    const columnNames = new Set(
      columns.map((row) => `${row.tableName}.${row.columnName}`),
    );
    for (const forbidden of [
      "ai_requests.user_input",
      "ai_requests.raw_input",
      "ai_requests.prompt",
      "ai_requests.request_body",
      "ai_requests.response_body",
      "ai_proposals.prompt",
      "ai_proposals.raw_response",
      "ai_proposals.request_body",
      "ai_proposals.response_body",
      "ai_operations.request_body",
      "ai_operations.response_body",
      "ai_provider_attempts.prompt",
      "ai_provider_attempts.request_body",
      "ai_provider_attempts.response_body",
      "ai_provider_attempts.credential",
      "ai_provider_attempts.raw_input",
      "ai_provider_attempts.raw_output",
    ]) {
      expect(columnNames.has(forbidden), forbidden).toBe(false);
    }

    const requestForeignKeys = await prisma.$queryRaw<ForeignKeyInfo[]>`
      SELECT
        TABLE_NAME AS tableName,
        COLUMN_NAME AS columnName,
        CONSTRAINT_NAME AS constraintName,
        REFERENCED_TABLE_NAME AS referencedTableName
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'ai_requests'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `;
    expect(requestForeignKeys).toEqual([
      expect.objectContaining({
        columnName: "user_id",
        constraintName: "ai_requests_user_id_fkey",
        referencedTableName: "users",
      }),
    ]);
  });

  it("anchors attempt time with NOT NULL started_at and keeps legacy business tables unchanged", async () => {
    const startedAt = new Date();
    const user = await createUser();
    const request = await createRequest(user.id, "anchor-req-1", "RUNNING");
    const attempt = await prisma.aiProviderAttempt.create({
      data: {
        aiRequestId: request.id,
        attemptNo: 1,
        providerId: "deepseek",
        startedAt,
        status: "RUNNING",
      },
    });
    const loaded = await prisma.aiProviderAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    expect(loaded.startedAt.toISOString()).toBe(startedAt.toISOString());
    expect(loaded.completedAt).toBeNull();

    const legacyColumns = await prisma.$queryRaw<ColumnInfo[]>`
      SELECT
        TABLE_NAME AS tableName,
        COLUMN_NAME AS columnName
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('users', 'draft_records', 'transactions')
    `;
    const byTable = new Map<string, Set<string>>();
    for (const row of legacyColumns) {
      const set = byTable.get(row.tableName) ?? new Set<string>();
      set.add(row.columnName);
      byTable.set(row.tableName, set);
    }
    expect(byTable.get("users")).toEqual(
      new Set([
        "id",
        "username",
        "normalized_username",
        "display_name",
        "password_hash",
        "must_change_password",
        "role",
        "status",
        "created_at",
        "updated_at",
        "closed_at",
        "deletion_requested_at",
        "deletion_scheduled_at",
        "deletion_started_at",
        "deletion_completed_at",
        "deletion_attempt_count",
        "deletion_last_error",
        "deletion_lease_expires_at",
        "last_login_at",
      ]),
    );
    for (const column of [
      "id",
      "user_id",
      "payload_json",
      "status",
      "created_at",
    ]) {
      expect(byTable.get("draft_records")?.has(column)).toBe(true);
    }
    for (const column of ["id", "user_id", "amount", "type", "status"]) {
      expect(byTable.get("transactions")?.has(column)).toBe(true);
    }
  });

  async function createUser() {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return prisma.user.create({
      data: {
        displayName: "V1.5 AI Test",
        normalizedUsername: `${usernamePrefix}${uniqueSuffix}`,
        passwordHash: "test-only-not-a-real-password-hash",
        role: "USER",
        status: "ACTIVE",
        username: `${usernamePrefix}${uniqueSuffix}`,
      },
    });
  }

  function createRequest(
    userId: string,
    requestId: string,
    status: AiRequestStatus,
    idempotencyKey = requestId,
  ) {
    return prisma.aiRequest.create({
      data: {
        idempotencyKey,
        inputFingerprint: "f".repeat(64),
        locale: "zh-CN",
        requestId,
        status,
        timeZoneId: "Asia/Shanghai",
        userId,
      },
    });
  }

  function createProposal(
    userId: string,
    aiRequestId: string,
    sourceDraftId: string | null,
    status: AiProposalStatus = "PENDING_REVIEW",
  ) {
    return prisma.aiProposal.create({
      data: {
        aiRequestId,
        modelId: "deepseek-v4-flash",
        providerId: "deepseek",
        responseFingerprint: "a".repeat(64),
        schemaVersion: 1,
        sourceDraftId,
        status,
        userId,
      },
    });
  }

  function createOperation(proposalId: string, ordinal: number) {
    return prisma.aiOperation.create({
      data: {
        confidence: "0.9",
        fieldsFingerprint: "b".repeat(64),
        fieldsJson: { amount: "1.00", type: "EXPENSE" },
        operationType: "TRANSACTION" satisfies AiOperationType,
        ordinal,
        proposalId,
        status: "PENDING" satisfies AiOperationStatus,
      },
    });
  }

  function createAttempt(aiRequestId: string, attemptNo: number) {
    return prisma.aiProviderAttempt.create({
      data: {
        aiRequestId,
        attemptNo,
        providerId: "deepseek",
        startedAt: new Date(),
        status: "SUCCEEDED" satisfies AiProviderAttemptStatus,
      },
    });
  }
});
