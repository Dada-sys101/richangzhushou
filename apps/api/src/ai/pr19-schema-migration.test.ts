import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const apiRoot = resolve(process.cwd());
const schema = readFileSync(resolve(apiRoot, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  resolve(
    apiRoot,
    "prisma/migrations/20260820000000_pr19_ai_request_original_input_retention/migration.sql",
  ),
  "utf8",
);

describe("PR19 authorized schema and migration slice", () => {
  it("adds only nullable original input retention fields and one expiry index", () => {
    expect(schema).toContain(
      'originalUserInput      String?             @map("original_user_input") @db.VarChar(2000)',
    );
    expect(schema).toContain(
      'originalInputExpiresAt DateTime?           @map("original_input_expires_at")',
    );
    expect(schema).toContain("@@index([originalInputExpiresAt])");
    expect(migration.match(/ADD COLUMN/g)).toHaveLength(2);
    expect(migration.match(/CREATE INDEX/g)).toHaveLength(1);
  });

  it("does not alter baseline locale/time_zone_id or unrelated structures", () => {
    expect(migration).not.toMatch(/\bALTER\s+COLUMN\b/i);
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toContain("`locale`");
    expect(migration).not.toContain("`time_zone_id`");
    expect(schema).not.toMatch(/original(?:Locale|TimeZone)/);
  });
});
