import type { ChildProcess } from "node:child_process";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertManagedDatabaseName,
  assertManagedGuardDatabaseName,
  assertManagedUserName,
  assertMySql84,
  assertScopedGrants,
  buildChildEnvironment,
  createDatabaseUrl,
  createTemporaryIdentifiers,
  ExitCode,
  parseAdminTarget,
  parseVitestCounts,
  redactText,
  runValidationLifecycle,
  RuntimeController,
  ValidationFailure,
  type AdminTarget,
  type BootstrapDatabase,
  type CommandRequest,
  type EvidencePayload,
  type TemporaryIdentifiers,
  type ValidationDependencies,
} from "./validate-temporary-mysql84.js";

const IDENTIFIERS: TemporaryIdentifiers = {
  databaseName: "daily_assistant_pr6a_testdb",
  guardDatabaseName: "daily_assistant_pr6a_guard_testdb",
  userName: "daily_assistant_pr6a_u_test",
  password: "temporary-password-012345678901234567890123",
};
const TARGET: AdminTarget = parseAdminTarget(
  "mysql://bootstrap:admin-secret@127.0.0.1:33384/mysql",
);
const GRANTS = [
  "GRANT USAGE ON *.* TO `daily_assistant_pr6a_u_test`@`%`",
  "GRANT ALL PRIVILEGES ON `daily_assistant_pr6a_testdb`.* TO `daily_assistant_pr6a_u_test`@`%`",
];
const TEST_SUMMARY = "Test Files  14 passed (14)\nTests  105 passed (105)\n";

class FakeBootstrapDatabase implements BootstrapDatabase {
  calls: string[] = [];
  fail = new Set<string>();
  residualDatabases = 0;
  residualUsers = 0;

  private async call(label: string): Promise<void> {
    this.calls.push(label);
    if (this.fail.has(label)) throw new Error(`${label} secret diagnostic`);
  }

  probe = async (): Promise<void> => this.call("probe");
  readVersion = async (): Promise<{
    version: string;
    versionComment: string;
  }> => {
    await this.call("readVersion");
    return { version: "8.4.9", versionComment: "MySQL Community Server - GPL" };
  };
  createDatabase = async (): Promise<void> => this.call("createDatabase");
  createGuardDatabase = async (): Promise<void> =>
    this.call("createGuardDatabase");
  createGuardMarker = async (): Promise<void> => this.call("createGuardMarker");
  createUser = async (): Promise<void> => this.call("createUser");
  grantDatabase = async (): Promise<void> => this.call("grantDatabase");
  showGrants = async (): Promise<string[]> => {
    await this.call("showGrants");
    return GRANTS;
  };
  verifyIsolation = async (): Promise<void> => this.call("verifyIsolation");
  dropDatabase = async (name: string): Promise<void> =>
    this.call(name.includes("guard") ? "dropGuardDatabase" : "dropDatabase");
  dropUser = async (): Promise<void> => this.call("dropUser");
  residualDatabaseCount = async (): Promise<number> => {
    await this.call("residualDatabaseCount");
    return this.residualDatabases;
  };
  residualUserCount = async (): Promise<number> => {
    await this.call("residualUserCount");
    return this.residualUsers;
  };
  disconnect = async (): Promise<void> => this.call("disconnect");
}

function createHarness(
  admin = new FakeBootstrapDatabase(),
  commandRunner?: ValidationDependencies["commandRunner"],
): {
  admin: FakeBootstrapDatabase;
  commands: CommandRequest[];
  dependencies: ValidationDependencies;
  evidence: EvidencePayload[];
  output: string[];
} {
  const commands: CommandRequest[] = [];
  const evidence: EvidencePayload[] = [];
  const output: string[] = [];
  return {
    admin,
    commands,
    evidence,
    output,
    dependencies: {
      async commandRunner(request) {
        commands.push(request);
        if (commandRunner) return commandRunner(request);
        return {
          output: request.exitCode === ExitCode.TESTS ? TEST_SUMMARY : "",
        };
      },
      createBootstrapDatabase: () => admin,
      createIdentifiers: () => ({ ...IDENTIFIERS }),
      migrationCount: async () => 9,
      now: vi
        .fn<() => Date>()
        .mockReturnValueOnce(new Date("2026-08-10T00:00:00.000Z"))
        .mockReturnValue(new Date("2026-08-10T00:00:01.000Z")),
      output: (_stream, value) => output.push(value),
      sleep: async () => undefined,
      async writeEvidence(label, payload) {
        evidence.push(payload);
        return {
          jsonPath: `output/pr6a/evidence/${label}.json`,
          sha256: "a".repeat(64),
          sha256Path: `output/pr6a/evidence/${label}.json.sha256`,
        };
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("host and identifier safety", () => {
  it("accepts only explicit loopback mysql system database URLs", () => {
    expect(
      parseAdminTarget("mysql://root@127.0.0.1:3307/mysql").displayHost,
    ).toBe("127.0.0.1:3307");
    expect(parseAdminTarget("mysql://root@localhost/mysql").displayHost).toBe(
      "localhost:3306",
    );
    expect(parseAdminTarget("mysql://root@[::1]/mysql").displayHost).toBe(
      "::1:3306",
    );
  });

  it.each([
    "mysql://root@192.168.1.10/mysql",
    "mysql://root@db.internal/mysql",
    "mysql://root@8.8.8.8/mysql",
  ])("rejects every non-loopback target without an override: %s", (url) => {
    vi.stubEnv("PR6A_ALLOW_NON_LOOPBACK", "1");
    expect(() => parseAdminTarget(url)).toThrow("No override is supported");
  });

  it("rejects missing, wrong-protocol, query-bearing, and non-system URLs", () => {
    expect(() => parseAdminTarget(undefined)).toThrow("is required");
    expect(() => parseAdminTarget("postgres://root@127.0.0.1/mysql")).toThrow(
      "mysql protocol",
    );
    expect(() => parseAdminTarget("mysql://root@127.0.0.1/app")).toThrow(
      "mysql system database",
    );
    expect(() =>
      parseAdminTarget("mysql://root@127.0.0.1/mysql?ssl=false"),
    ).toThrow("query parameters");
  });

  it("accepts only Oracle MySQL 8.4", () => {
    expect(() =>
      assertMySql84("8.4.9", "MySQL Community Server - GPL"),
    ).not.toThrow();
    expect(() =>
      assertMySql84("8.0.43", "MySQL Community Server - GPL"),
    ).toThrow("requires MySQL 8.4.x");
    expect(() => assertMySql84("8.4.9-MariaDB", "MariaDB Server")).toThrow(
      "not MariaDB",
    );
  });

  it("generates valid random database, guard, user, and password values", () => {
    const generated = createTemporaryIdentifiers();
    expect(() =>
      assertManagedDatabaseName(generated.databaseName),
    ).not.toThrow();
    expect(() =>
      assertManagedGuardDatabaseName(generated.guardDatabaseName),
    ).not.toThrow();
    expect(() => assertManagedUserName(generated.userName)).not.toThrow();
    expect(generated.password.length).toBeGreaterThanOrEqual(40);
  });

  it("refuses cleanup-scope identifiers outside internal namespaces", () => {
    expect(() => assertManagedDatabaseName("daily_assistant")).toThrow(
      "outside the daily_assistant_pr6a_* namespace",
    );
    expect(() =>
      assertManagedDatabaseName(IDENTIFIERS.guardDatabaseName),
    ).toThrow("failed the safety policy");
    expect(() => assertManagedGuardDatabaseName("mysql")).toThrow(
      "guard database",
    );
    expect(() => assertManagedUserName("root")).toThrow("outside");
  });
});

describe("credential isolation and redaction", () => {
  it("builds a temporary-user URL without preserving admin credentials", () => {
    const url = createDatabaseUrl(
      TARGET.url,
      IDENTIFIERS.databaseName,
      IDENTIFIERS.userName,
      IDENTIFIERS.password,
    );
    const parsed = new URL(url);
    expect(parsed.username).toBe(IDENTIFIERS.userName);
    expect(parsed.password).toBe(IDENTIFIERS.password);
    expect(parsed.password).not.toBe(TARGET.url.password);
  });

  it("uses an allowlist and injects only temporary database credentials", () => {
    vi.stubEnv("PR6A_MYSQL_ADMIN_URL", TARGET.url.href);
    vi.stubEnv("UNRELATED_TOKEN", "must-not-pass");
    vi.stubEnv("DATABASE_URL", "mysql://admin:old-secret@127.0.0.1/mysql");
    const temporaryUrl = createDatabaseUrl(
      TARGET.url,
      IDENTIFIERS.databaseName,
      IDENTIFIERS.userName,
      IDENTIFIERS.password,
    );
    const environment = buildChildEnvironment(temporaryUrl);
    expect(environment.DATABASE_URL).toBe(temporaryUrl);
    expect(environment.TEST_DATABASE_URL).toBe(temporaryUrl);
    expect(environment.PR6A_MYSQL_ADMIN_URL).toBeUndefined();
    expect(environment.UNRELATED_TOKEN).toBeUndefined();
    expect(JSON.stringify(environment)).not.toContain("admin-secret");
  });

  it("redacts URLs, raw secrets, and encoded secrets", () => {
    const adminPassword = "admin-secret";
    const temporaryPassword = "temp pass/word";
    const encoded = encodeURIComponent(temporaryPassword);
    const input = [
      adminPassword,
      temporaryPassword,
      encoded,
      `mysql://root:${adminPassword}@127.0.0.1/mysql`,
      `mysql://temp:${encoded}@127.0.0.1/db`,
    ].join(" | ");
    const output = redactText(input, [adminPassword, temporaryPassword]);
    expect(output).not.toContain(adminPassword);
    expect(output).not.toContain(temporaryPassword);
    expect(output).not.toContain(encoded);
    expect(output).not.toContain("mysql://");
    expect(output).toContain("[REDACTED]");
  });

  it("rejects global, cross-database, and grant-option privileges", () => {
    expect(() =>
      assertScopedGrants(GRANTS, IDENTIFIERS.databaseName),
    ).not.toThrow();
    expect(() =>
      assertScopedGrants(
        ["GRANT ALL PRIVILEGES ON *.* TO `user`@`%`"],
        IDENTIFIERS.databaseName,
      ),
    ).toThrow("not restricted");
    expect(() =>
      assertScopedGrants(
        [`GRANT ALL PRIVILEGES ON \`other\`.* TO \`user\`@\`%\``],
        IDENTIFIERS.databaseName,
      ),
    ).toThrow("not restricted");
    expect(() =>
      assertScopedGrants(
        [`${GRANTS[1]} WITH GRANT OPTION`],
        IDENTIFIERS.databaseName,
      ),
    ).toThrow("GRANT OPTION");
  });
});

describe("validation lifecycle", () => {
  it("passes success, captures counts, and performs full cleanup", async () => {
    const harness = createHarness();
    const result = await runValidationLifecycle(
      TARGET,
      "success",
      new RuntimeController(),
      harness.dependencies,
      undefined,
    );
    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect(harness.commands).toHaveLength(2);
    expect(harness.evidence[0]).toMatchObject({
      migrationCount: 9,
      dbTestFileCount: 14,
      dbTestCount: 105,
      isolationCheck: true,
      cleanupDatabase: true,
      cleanupGuardDatabase: true,
      cleanupUser: true,
      residualDatabaseCount: 0,
      residualUserCount: 0,
      result: "PASS",
    });
  });

  it("uses only the temporary user URL in every child request", async () => {
    const harness = createHarness();
    await runValidationLifecycle(
      TARGET,
      "env",
      new RuntimeController(),
      harness.dependencies,
      undefined,
    );
    for (const command of harness.commands) {
      const serialized = JSON.stringify(command.environment);
      expect(serialized).toContain(IDENTIFIERS.userName);
      expect(serialized).toContain(encodeURIComponent(IDENTIFIERS.password));
      expect(serialized).not.toContain("bootstrap");
      expect(serialized).not.toContain("admin-secret");
      expect(command.environment.PR6A_MYSQL_ADMIN_URL).toBeUndefined();
    }
  });

  it("attempts database, guard, and user cleanup when CREATE DATABASE throws", async () => {
    const admin = new FakeBootstrapDatabase();
    admin.fail.add("createDatabase");
    const harness = createHarness(admin);
    const result = await runValidationLifecycle(
      TARGET,
      "partial-create",
      new RuntimeController(),
      harness.dependencies,
      undefined,
    );
    expect(result.exitCode).toBe(ExitCode.BOOTSTRAP);
    expect(admin.calls).toEqual(
      expect.arrayContaining(["dropDatabase", "dropGuardDatabase", "dropUser"]),
    );
  });

  it("uses bounded readiness retries and returns the readiness exit code", async () => {
    const admin = new FakeBootstrapDatabase();
    admin.fail.add("probe");
    const harness = createHarness(admin);
    const result = await runValidationLifecycle(
      TARGET,
      "readiness",
      new RuntimeController(),
      harness.dependencies,
      undefined,
    );
    expect(result.exitCode).toBe(ExitCode.READINESS);
    expect(admin.calls.filter((call) => call === "probe")).toHaveLength(12);
    expect(admin.calls).toContain("dropDatabase");
  });

  it.each([
    [ExitCode.MIGRATION, ExitCode.MIGRATION, "migration failure"],
    [ExitCode.TESTS, ExitCode.TESTS, "test failure"],
    [ExitCode.MIGRATION, ExitCode.SPAWN, "spawn failure"],
  ])(
    "propagates %s command failures with cleanup",
    async (phase, failureCode, message) => {
      const harness = createHarness(undefined, async (request) => {
        if (request.exitCode === phase) {
          throw Object.assign(new Error(message), {
            exitCode: failureCode,
            kind:
              failureCode === ExitCode.SPAWN
                ? "SPAWN_FAILURE"
                : "COMMAND_FAILURE",
          });
        }
        return { output: TEST_SUMMARY };
      });
      const original = harness.dependencies.commandRunner;
      harness.dependencies.commandRunner = async (request) => {
        try {
          return await original(request);
        } catch (error) {
          const typed = error as Error & { exitCode: ExitCode; kind: string };
          throw new ValidationFailure(
            typed.exitCode,
            typed.kind,
            typed.message,
          );
        }
      };
      const result = await runValidationLifecycle(
        TARGET,
        "command-failure",
        new RuntimeController(),
        harness.dependencies,
        undefined,
      );
      expect(result.exitCode).toBe(failureCode);
      expect(harness.admin.calls).toContain("dropUser");
    },
  );

  it("returns a stable test failure for the injected post-migration path", async () => {
    const harness = createHarness();
    const result = await runValidationLifecycle(
      TARGET,
      "injected",
      new RuntimeController(),
      harness.dependencies,
      "after-migration",
    );
    expect(result.exitCode).toBe(ExitCode.TESTS);
    expect(harness.commands).toHaveLength(1);
    expect(harness.evidence[0]?.result).toBe("EXPECTED_FAILURE");
  });

  it("keeps primary and cleanup failures as separate diagnostics", async () => {
    const admin = new FakeBootstrapDatabase();
    admin.fail.add("dropUser");
    const harness = createHarness(admin, async (request) => {
      if (request.exitCode === ExitCode.MIGRATION) {
        throw new ValidationFailure(
          ExitCode.MIGRATION,
          "MIGRATION_FAILURE",
          "migration failed",
        );
      }
      return { output: TEST_SUMMARY };
    });
    const result = await runValidationLifecycle(
      TARGET,
      "dual-failure",
      new RuntimeController(),
      harness.dependencies,
      undefined,
    );
    expect(result.exitCode).toBe(ExitCode.CLEANUP);
    expect(result.primaryFailure?.kind).toBe("MIGRATION_FAILURE");
    expect(result.cleanupFailure?.kind).toBe("CLEANUP_FAILURE");
    expect(harness.evidence[0]?.primaryFailure).toContain("MIGRATION_FAILURE");
    expect(harness.evidence[0]?.cleanupFailure).toContain("DROP_USER");
  });

  it("continues all cleanup steps after a cleanup failure", async () => {
    const admin = new FakeBootstrapDatabase();
    admin.fail.add("dropDatabase");
    admin.fail.add("dropGuardDatabase");
    const harness = createHarness(admin);
    const result = await runValidationLifecycle(
      TARGET,
      "cleanup",
      new RuntimeController(),
      harness.dependencies,
      undefined,
    );
    expect(result.exitCode).toBe(ExitCode.CLEANUP);
    expect(admin.calls).toEqual(
      expect.arrayContaining([
        "dropUser",
        "residualDatabaseCount",
        "residualUserCount",
        "disconnect",
      ]),
    );
  });

  it("cleanup operations are safe to repeat across lifecycle executions", async () => {
    const admin = new FakeBootstrapDatabase();
    const harness = createHarness(admin);
    const first = await runValidationLifecycle(
      TARGET,
      "repeat-1",
      new RuntimeController(),
      harness.dependencies,
      undefined,
    );
    const second = await runValidationLifecycle(
      TARGET,
      "repeat-2",
      new RuntimeController(),
      harness.dependencies,
      undefined,
    );
    expect([first.exitCode, second.exitCode]).toEqual([0, 0]);
    expect(admin.calls.filter((call) => call === "dropUser")).toHaveLength(2);
  });

  it.each(["SIGINT", "SIGTERM"] as const)(
    "terminates the process tree, cleans up, and returns non-zero on %s",
    async (signal) => {
      let releaseCommand: (() => void) | undefined;
      const terminated = vi.fn(async () => releaseCommand?.());
      const controller = new RuntimeController(terminated);
      const harness = createHarness(undefined, async (request) => {
        if (request.exitCode !== ExitCode.MIGRATION)
          return { output: TEST_SUMMARY };
        controller.setActiveChild({
          pid: 12345,
          exitCode: null,
        } as ChildProcess);
        await new Promise<void>((resolve) => {
          releaseCommand = resolve;
          setTimeout(() => controller.requestSignal(signal), 0);
        });
        throw new ValidationFailure(
          ExitCode.SIGNAL,
          "SIGNAL",
          `Interrupted by ${signal}.`,
        );
      });
      const result = await runValidationLifecycle(
        TARGET,
        `signal-${signal.toLowerCase()}`,
        controller,
        harness.dependencies,
        undefined,
      );
      expect(result.exitCode).toBe(ExitCode.SIGNAL);
      expect(terminated).toHaveBeenCalledOnce();
      expect(harness.admin.calls).toEqual(
        expect.arrayContaining([
          "dropDatabase",
          "dropGuardDatabase",
          "dropUser",
        ]),
      );
      expect(harness.evidence[0]).toMatchObject({
        result: "INTERRUPTED",
        processTreeTerminationRequested: true,
      });
    },
  );
});

describe("evidence parsing", () => {
  it("parses Vitest file and test totals", () => {
    expect(parseVitestCounts(TEST_SUMMARY)).toEqual({
      fileCount: 14,
      testCount: 105,
    });
  });
});
