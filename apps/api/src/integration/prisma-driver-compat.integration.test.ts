import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Prisma, PrismaClient } from "../generated/prisma/client.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDb = testDatabaseUrl ? describe : describe.skip;
const PROBE_TABLE = "_prisma_override_compat_probe";

describeWithDb("Prisma override driver compatibility", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    prisma = new PrismaClient({ adapter: new PrismaMariaDb(testDatabaseUrl) });
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${PROBE_TABLE}\``);
    await prisma.$executeRawUnsafe(
      `CREATE TABLE \`${PROBE_TABLE}\` (` +
        "`id` VARCHAR(64) NOT NULL PRIMARY KEY," +
        "`amount` DECIMAL(18,2) NOT NULL," +
        "`note` VARCHAR(191) NOT NULL" +
        ") CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${PROBE_TABLE}\``);
    await prisma.$disconnect();
  });

  it("preserves decimal precision, utf8mb4 text, and Prisma type mapping", async () => {
    await prisma.$executeRaw`
      INSERT INTO _prisma_override_compat_probe (id, amount, note)
      VALUES ('types', ${new Prisma.Decimal("0.30")}, ${"中文🙂"})
    `;
    const rows = await prisma.$queryRaw<
      Array<{ amount: Prisma.Decimal; note: string }>
    >`SELECT amount, note FROM _prisma_override_compat_probe WHERE id = 'types'`;
    expect(rows[0]?.amount.toFixed(2)).toBe("0.30");
    expect(rows[0]?.note).toBe("中文🙂");
  });

  it("commits successful transactions and rolls back thrown transactions", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO _prisma_override_compat_probe (id, amount, note)
        VALUES ('commit', 1.25, 'committed')
      `;
    });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO _prisma_override_compat_probe (id, amount, note)
          VALUES ('rollback', 2.50, 'rolled back')
        `;
        throw new Error("intentional rollback probe");
      }),
    ).rejects.toThrow("intentional rollback probe");

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM _prisma_override_compat_probe
      WHERE id IN ('commit', 'rollback') ORDER BY id
    `;
    expect(rows.map(({ id }) => id)).toEqual(["commit"]);
  });

  it("recovers after an interactive transaction timeout", async () => {
    await expect(
      prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT SLEEP(0.20)`;
        },
        { maxWait: 1_000, timeout: 50 },
      ),
    ).rejects.toThrow();
    await expect(prisma.$queryRaw`SELECT 1`).resolves.toBeTruthy();
  });

  it("releases a pooled connection on disconnect and can reconnect explicitly", async () => {
    const extra = new PrismaClient({
      adapter: new PrismaMariaDb(testDatabaseUrl!),
    });
    try {
      const connection = await extra.$queryRaw<Array<{ connectionId: bigint }>>`
        SELECT CONNECTION_ID() AS connectionId
      `;
      const connectionId = connection[0]?.connectionId;
      expect(connectionId).toBeDefined();
      await extra.$disconnect();

      let active = 1;
      for (let attempt = 0; attempt < 20 && active !== 0; attempt += 1) {
        const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) AS count FROM information_schema.processlist
          WHERE ID = ${connectionId}
        `;
        active = Number(rows[0]?.count ?? 0);
        if (active !== 0)
          await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(active).toBe(0);
      await expect(extra.$queryRaw`SELECT 1`).resolves.toBeTruthy();
    } finally {
      await extra.$disconnect();
    }
  });

  it("uses the expected MySQL session charset and exposes transport status", async () => {
    const session = await prisma.$queryRaw<
      Array<{
        characterSetClient: string;
        characterSetConnection: string;
        characterSetResults: string;
        collationConnection: string;
      }>
    >`
      SELECT
        @@character_set_client AS characterSetClient,
        @@character_set_connection AS characterSetConnection,
        @@character_set_results AS characterSetResults,
        @@collation_connection AS collationConnection
    `;
    expect(session[0]).toMatchObject({
      characterSetClient: "utf8mb4",
      characterSetConnection: "utf8mb4",
      characterSetResults: "utf8mb4",
    });
    expect(session[0]?.collationConnection).toMatch(/^utf8mb4_/);

    const transport = await prisma.$queryRaw<
      Array<{ Variable_name: string; Value: string }>
    >`SHOW SESSION STATUS WHERE Variable_name IN ('Compression', 'Ssl_cipher')`;
    expect(transport.map(({ Variable_name }) => Variable_name).sort()).toEqual([
      "Compression",
      "Ssl_cipher",
    ]);
  });
});
