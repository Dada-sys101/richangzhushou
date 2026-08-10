import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { Prisma, PrismaClient } from "../generated/prisma/client.js";

const DATABASE_PREFIX = "daily_assistant_pr6a_";
const GUARD_DATABASE_PREFIX = "daily_assistant_pr6a_guard_";
const USER_PREFIX = "daily_assistant_pr6a_u_";
const REQUIRED_ADMIN_DATABASE = "mysql";
const ROOT_DIRECTORY = path.resolve(__dirname, "../../../..");
const EVIDENCE_DIRECTORY = path.join(
  ROOT_DIRECTORY,
  "output",
  "pr6a",
  "evidence",
);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const USER_HOST = "%";
const READINESS_ATTEMPTS = 12;
const READINESS_DELAY_MS = 500;

interface ServerVersionRow {
  version: string;
  versionComment: string;
}

interface CountRow {
  count: bigint | number;
}

export interface AdminTarget {
  displayHost: string;
  url: URL;
}

export interface TemporaryIdentifiers {
  databaseName: string;
  guardDatabaseName: string;
  userName: string;
  password: string;
}

export interface CommandResult {
  output: string;
}

export interface CommandRequest {
  args: string[];
  environment: NodeJS.ProcessEnv;
  exitCode: ExitCode;
  label: string;
}

export interface BootstrapDatabase {
  createDatabase(databaseName: string): Promise<void>;
  createGuardDatabase(databaseName: string): Promise<void>;
  createGuardMarker(databaseName: string): Promise<void>;
  createUser(userName: string, password: string): Promise<void>;
  disconnect(): Promise<void>;
  dropDatabase(databaseName: string): Promise<void>;
  dropUser(userName: string): Promise<void>;
  probe(): Promise<void>;
  readVersion(): Promise<ServerVersionRow>;
  residualDatabaseCount(databaseNames: string[]): Promise<number>;
  residualUserCount(userName: string): Promise<number>;
  grantDatabase(databaseName: string, userName: string): Promise<void>;
  showGrants(userName: string): Promise<string[]>;
  verifyIsolation(
    temporaryUrl: string,
    guardDatabaseName: string,
  ): Promise<void>;
}

export interface ValidationDependencies {
  commandRunner: (request: CommandRequest) => Promise<CommandResult>;
  createBootstrapDatabase: (adminUrl: URL) => BootstrapDatabase;
  createIdentifiers: () => TemporaryIdentifiers;
  migrationCount: () => Promise<number>;
  now: () => Date;
  output: (stream: "stdout" | "stderr", value: string) => void;
  sleep: (milliseconds: number) => Promise<void>;
  writeEvidence: (
    label: string,
    evidence: EvidencePayload,
  ) => Promise<EvidenceWriteResult>;
}

export interface EvidencePayload {
  schemaVersion: 1;
  label: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  mysqlVersion: string | null;
  databaseIdentifierSha256: string;
  userIdentifierSha256: string;
  migrationCount: number;
  dbTestFileCount: number;
  dbTestCount: number;
  isolationCheck: boolean;
  processTreeTerminationRequested: boolean;
  cleanupDatabase: boolean;
  cleanupGuardDatabase: boolean;
  cleanupUser: boolean;
  residualDatabaseCount: number | null;
  residualUserCount: number | null;
  exitCode: number;
  result: "PASS" | "EXPECTED_FAILURE" | "FAIL" | "INTERRUPTED";
  primaryFailure: string | null;
  cleanupFailure: string | null;
}

export interface EvidenceWriteResult {
  jsonPath: string;
  sha256: string;
  sha256Path: string;
}

export interface ValidationResult {
  cleanupFailure?: ValidationFailure;
  evidence?: EvidenceWriteResult;
  exitCode: ExitCode;
  primaryFailure?: ValidationFailure;
  signal?: NodeJS.Signals;
}

export enum ExitCode {
  SUCCESS = 0,
  CONFIG = 10,
  READINESS = 20,
  VERSION = 21,
  BOOTSTRAP = 30,
  MIGRATION = 40,
  TESTS = 41,
  SPAWN = 42,
  CLEANUP = 50,
  SIGNAL = 60,
  INTERNAL = 70,
}

export class ValidationFailure extends Error {
  constructor(
    public readonly exitCode: ExitCode,
    public readonly kind: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ValidationFailure";
  }
}

export class RuntimeController {
  private activeChild: ChildProcess | undefined;
  private terminationPromise: Promise<void> | undefined;
  signal: NodeJS.Signals | undefined;
  processTreeTerminationRequested = false;

  constructor(
    private readonly terminateTree: (
      child: ChildProcess,
    ) => Promise<void> = terminateProcessTree,
  ) {}

  setActiveChild(child: ChildProcess): void {
    this.activeChild = child;
    if (this.signal) {
      void this.requestTreeTermination();
    }
  }

  clearActiveChild(child: ChildProcess): void {
    if (this.activeChild === child) {
      this.activeChild = undefined;
    }
  }

  requestSignal(signal: NodeJS.Signals): void {
    if (this.signal) {
      return;
    }
    this.signal = signal;
    void this.requestTreeTermination().catch(() => undefined);
  }

  async requestTreeTermination(): Promise<void> {
    if (!this.activeChild) {
      return;
    }
    if (!this.terminationPromise) {
      this.processTreeTerminationRequested = true;
      this.terminationPromise = this.terminateTree(this.activeChild);
    }
    await this.terminationPromise;
  }

  async settleTermination(): Promise<void> {
    await this.terminationPromise;
  }
}

export function parseAdminTarget(rawUrl: string | undefined): AdminTarget {
  if (!rawUrl) {
    throw new ValidationFailure(
      ExitCode.CONFIG,
      "INVALID_CONFIG",
      "PR6A_MYSQL_ADMIN_URL is required and must target the mysql system database.",
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ValidationFailure(
      ExitCode.CONFIG,
      "INVALID_CONFIG",
      "PR6A_MYSQL_ADMIN_URL must be a valid URL.",
    );
  }

  if (url.protocol !== "mysql:") {
    throw new ValidationFailure(
      ExitCode.CONFIG,
      "INVALID_CONFIG",
      "PR6A_MYSQL_ADMIN_URL must use the mysql protocol.",
    );
  }
  if (url.search || url.hash) {
    throw new ValidationFailure(
      ExitCode.CONFIG,
      "INVALID_CONFIG",
      "PR6A_MYSQL_ADMIN_URL must not contain query parameters or a fragment.",
    );
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (databaseName !== REQUIRED_ADMIN_DATABASE) {
    throw new ValidationFailure(
      ExitCode.CONFIG,
      "INVALID_CONFIG",
      `PR6A_MYSQL_ADMIN_URL must select the ${REQUIRED_ADMIN_DATABASE} system database, not an application database.`,
    );
  }

  const normalizedHost = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!LOOPBACK_HOSTS.has(normalizedHost)) {
    throw new ValidationFailure(
      ExitCode.CONFIG,
      "UNSAFE_HOST",
      "PR6A_MYSQL_ADMIN_URL must use 127.0.0.1, ::1, or localhost. No override is supported.",
    );
  }

  return {
    displayHost: `${normalizedHost}:${url.port || "3306"}`,
    url,
  };
}

export function assertMySql84(version: string, versionComment: string): void {
  if (/mariadb/i.test(`${version} ${versionComment}`)) {
    throw new ValidationFailure(
      ExitCode.VERSION,
      "UNSUPPORTED_VERSION",
      "The temporary validation entry requires Oracle MySQL 8.4, not MariaDB.",
    );
  }
  if (!/^8\.4(?:\.|$)/.test(version)) {
    throw new ValidationFailure(
      ExitCode.VERSION,
      "UNSUPPORTED_VERSION",
      `The temporary validation entry requires MySQL 8.4.x; detected ${version || "unknown"}.`,
    );
  }
}

export function createTemporaryIdentifiers(): TemporaryIdentifiers {
  const suffix =
    `${process.pid}_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`.toLowerCase();
  const identifiers = {
    databaseName: `${DATABASE_PREFIX}${suffix}`,
    guardDatabaseName: `${GUARD_DATABASE_PREFIX}${suffix}`,
    userName: `${USER_PREFIX}${randomBytes(4).toString("hex")}`,
    password: randomBytes(32).toString("base64url"),
  };
  assertManagedDatabaseName(identifiers.databaseName);
  assertManagedGuardDatabaseName(identifiers.guardDatabaseName);
  assertManagedUserName(identifiers.userName);
  return identifiers;
}

export function createTemporaryDatabaseName(): string {
  return createTemporaryIdentifiers().databaseName;
}

export function assertManagedDatabaseName(databaseName: string): void {
  if (!/^daily_assistant_pr6a_[a-z0-9_]+$/.test(databaseName)) {
    throw new ValidationFailure(
      ExitCode.CONFIG,
      "UNSAFE_IDENTIFIER",
      "Refusing to manage a database outside the daily_assistant_pr6a_* namespace.",
    );
  }
  if (
    databaseName.startsWith(GUARD_DATABASE_PREFIX) ||
    databaseName.length > 64
  ) {
    throw new ValidationFailure(
      ExitCode.CONFIG,
      "UNSAFE_IDENTIFIER",
      "Generated temporary database name failed the safety policy.",
    );
  }
}

export function assertManagedGuardDatabaseName(databaseName: string): void {
  if (
    !/^daily_assistant_pr6a_guard_[a-z0-9_]+$/.test(databaseName) ||
    databaseName.length > 64
  ) {
    throw new ValidationFailure(
      ExitCode.CONFIG,
      "UNSAFE_IDENTIFIER",
      "Refusing to manage a guard database outside the daily_assistant_pr6a_guard_* namespace.",
    );
  }
}

export function assertManagedUserName(userName: string): void {
  if (
    !/^daily_assistant_pr6a_u_[a-z0-9_]+$/.test(userName) ||
    userName.length > 32
  ) {
    throw new ValidationFailure(
      ExitCode.CONFIG,
      "UNSAFE_IDENTIFIER",
      "Refusing to manage a user outside the daily_assistant_pr6a_u_* namespace.",
    );
  }
}

export function createDatabaseUrl(
  adminUrl: URL,
  databaseName: string,
  userName?: string,
  password?: string,
): string {
  assertManagedDatabaseName(databaseName);
  const databaseUrl = new URL(adminUrl.href);
  databaseUrl.pathname = `/${databaseName}`;
  if (userName !== undefined || password !== undefined) {
    if (!userName || password === undefined) {
      throw new ValidationFailure(
        ExitCode.CONFIG,
        "INVALID_CONFIG",
        "Temporary user name and password must be supplied together.",
      );
    }
    assertManagedUserName(userName);
    databaseUrl.username = userName;
    databaseUrl.password = password;
    // MySQL 8.4 defaults to caching_sha2_password. The MariaDB driver needs
    // explicit public-key retrieval for a password-authenticated loopback
    // connection when TLS is not configured on the disposable instance.
    databaseUrl.searchParams.set("allowPublicKeyRetrieval", "true");
  }
  return databaseUrl.href;
}

export function buildChildEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
  const allowedKeys =
    process.platform === "win32"
      ? [
          "PATH",
          "PATHEXT",
          "SystemRoot",
          "WINDIR",
          "TEMP",
          "TMP",
          "ComSpec",
          "USERPROFILE",
          "APPDATA",
          "LOCALAPPDATA",
        ]
      : ["PATH", "HOME", "TMPDIR", "SHELL", "LANG", "LC_ALL", "TERM"];
  const environment: NodeJS.ProcessEnv = {};
  for (const key of allowedKeys) {
    if (process.env[key] !== undefined) {
      environment[key] = process.env[key];
    }
  }
  for (const key of ["CI", "NO_COLOR"]) {
    if (process.env[key] !== undefined) {
      environment[key] = process.env[key];
    }
  }
  environment.FORCE_COLOR = "0";
  environment.DATABASE_URL = databaseUrl;
  environment.TEST_DATABASE_URL = databaseUrl;
  return environment;
}

export function redactText(value: string, knownSecrets: string[]): string {
  let redacted = value.replace(/mysql:\/\/[^\s"'<>]+/gi, "[REDACTED]");
  const variants = knownSecrets
    .flatMap((secret) => {
      if (!secret) return [];
      const decoded = safeDecodeURIComponent(secret);
      return [secret, encodeURIComponent(secret), decoded];
    })
    .filter(
      (secret, index, values) => secret && values.indexOf(secret) === index,
    )
    .sort((left, right) => right.length - left.length);
  for (const secret of variants) {
    redacted = redacted.replace(
      new RegExp(escapeRegExp(secret), "g"),
      "[REDACTED]",
    );
  }
  return redacted;
}

export function assertScopedGrants(
  grants: string[],
  databaseName: string,
): void {
  assertManagedDatabaseName(databaseName);
  if (grants.some((grant) => /WITH GRANT OPTION/i.test(grant))) {
    throw new ValidationFailure(
      ExitCode.BOOTSTRAP,
      "GRANT_SCOPE",
      "Temporary user unexpectedly has GRANT OPTION.",
    );
  }
  const substantive = grants.filter(
    (grant) => !/^GRANT USAGE ON \*\.\*/i.test(grant),
  );
  const escapedName = escapeRegExp(databaseName);
  const targetPattern = new RegExp(
    "^GRANT ALL PRIVILEGES ON `" + escapedName + "`\\.\\* TO ",
    "i",
  );
  if (substantive.length !== 1 || !targetPattern.test(substantive[0] ?? "")) {
    throw new ValidationFailure(
      ExitCode.BOOTSTRAP,
      "GRANT_SCOPE",
      "Temporary user grants are not restricted to the generated database.",
    );
  }
}

export async function runValidationLifecycle(
  target: AdminTarget,
  evidenceLabel: string,
  controller: RuntimeController,
  dependencies: ValidationDependencies,
  injectionStep = process.env.PR6A_INJECT_FAILURE_STEP,
): Promise<ValidationResult> {
  const startedAt = dependencies.now();
  const identifiers = dependencies.createIdentifiers();
  assertManagedDatabaseName(identifiers.databaseName);
  assertManagedGuardDatabaseName(identifiers.guardDatabaseName);
  assertManagedUserName(identifiers.userName);

  const temporaryUrl = createDatabaseUrl(
    target.url,
    identifiers.databaseName,
    identifiers.userName,
    identifiers.password,
  );
  const childEnvironment = buildChildEnvironment(temporaryUrl);
  const admin = dependencies.createBootstrapDatabase(target.url);
  const knownSecrets = [
    target.url.href,
    target.url.password,
    identifiers.password,
    temporaryUrl,
  ];
  const log = (stream: "stdout" | "stderr", value: string): void =>
    dependencies.output(stream, redactText(value, knownSecrets));

  let primaryFailure: ValidationFailure | undefined;
  let cleanupFailure: ValidationFailure | undefined;
  let mysqlVersion: string | null = null;
  let migrationCount = 0;
  let dbTestFileCount = 0;
  let dbTestCount = 0;
  let isolationCheck = false;
  let cleanupDatabase = false;
  let cleanupGuardDatabase = false;
  let cleanupUser = false;
  let residualDatabaseCount: number | null = null;
  let residualUserCount: number | null = null;

  log(
    "stdout",
    `[pr6a] Target: ${target.displayHost} (credentials redacted)\n`,
  );
  log(
    "stdout",
    `[pr6a] Resource fingerprint: ${identifierHash(identifiers.databaseName).slice(0, 12)}\n`,
  );

  try {
    await waitForReadiness(admin, dependencies);
    const version = await admin.readVersion();
    assertMySql84(version.version, version.versionComment);
    mysqlVersion = version.version;
    log("stdout", `[pr6a] Version guard passed: MySQL ${version.version}\n`);

    await asBootstrapOperation("CREATE_DATABASE", () =>
      admin.createDatabase(identifiers.databaseName),
    );
    await asBootstrapOperation("CREATE_GUARD_DATABASE", () =>
      admin.createGuardDatabase(identifiers.guardDatabaseName),
    );
    await asBootstrapOperation("CREATE_GUARD_MARKER", () =>
      admin.createGuardMarker(identifiers.guardDatabaseName),
    );
    await asBootstrapOperation("CREATE_USER", () =>
      admin.createUser(identifiers.userName, identifiers.password),
    );
    await asBootstrapOperation("GRANT_DATABASE", () =>
      admin.grantDatabase(identifiers.databaseName, identifiers.userName),
    );
    const grants = await asBootstrapOperation("SHOW_GRANTS", () =>
      admin.showGrants(identifiers.userName),
    );
    assertScopedGrants(grants, identifiers.databaseName);
    await asBootstrapOperation("ISOLATION_CHECK", () =>
      admin.verifyIsolation(temporaryUrl, identifiers.guardDatabaseName),
    );
    isolationCheck = true;

    migrationCount = await dependencies.migrationCount();
    await dependencies.commandRunner({
      args: [
        "run",
        "prisma:migrate:deploy",
        "--workspace",
        "@daily-assistant/api",
      ],
      environment: childEnvironment,
      exitCode: ExitCode.MIGRATION,
      label: "Apply all migrations to the empty database",
    });

    if (injectionStep === "after-migration") {
      throw new ValidationFailure(
        ExitCode.TESTS,
        "INJECTED_FAILURE",
        "Injected post-migration failure for cleanup verification.",
      );
    }

    const testResult = await dependencies.commandRunner({
      args: ["run", "test:integration", "--workspace", "@daily-assistant/api"],
      environment: childEnvironment,
      exitCode: ExitCode.TESTS,
      label: "Run database integration tests",
    });
    ({ fileCount: dbTestFileCount, testCount: dbTestCount } = parseVitestCounts(
      testResult.output,
    ));
    if (dbTestFileCount === 0 || dbTestCount === 0) {
      throw new ValidationFailure(
        ExitCode.TESTS,
        "TEST_EVIDENCE",
        "Vitest completed without a parseable non-zero test summary.",
      );
    }
    log("stdout", "[pr6a] Migration and database tests passed.\n");
  } catch (error) {
    primaryFailure = normalizeFailure(
      error,
      ExitCode.INTERNAL,
      "PRIMARY_FAILURE",
    );
  } finally {
    const cleanupDiagnostics: string[] = [];
    await cleanupAttempt(
      "TERMINATE_PROCESS_TREE",
      async () => {
        await controller.requestTreeTermination();
        await controller.settleTermination();
      },
      cleanupDiagnostics,
    );
    await cleanupAttempt(
      "DROP_DATABASE",
      async () => {
        assertManagedDatabaseName(identifiers.databaseName);
        await admin.dropDatabase(identifiers.databaseName);
        cleanupDatabase = true;
      },
      cleanupDiagnostics,
    );
    await cleanupAttempt(
      "DROP_GUARD_DATABASE",
      async () => {
        assertManagedGuardDatabaseName(identifiers.guardDatabaseName);
        await admin.dropDatabase(identifiers.guardDatabaseName);
        cleanupGuardDatabase = true;
      },
      cleanupDiagnostics,
    );
    await cleanupAttempt(
      "DROP_USER",
      async () => {
        assertManagedUserName(identifiers.userName);
        await admin.dropUser(identifiers.userName);
        cleanupUser = true;
      },
      cleanupDiagnostics,
    );
    await cleanupAttempt(
      "VERIFY_DATABASES",
      async () => {
        residualDatabaseCount = await admin.residualDatabaseCount([
          identifiers.databaseName,
          identifiers.guardDatabaseName,
        ]);
        if (residualDatabaseCount !== 0) {
          throw new Error(
            `Residual database count is ${residualDatabaseCount}.`,
          );
        }
      },
      cleanupDiagnostics,
    );
    await cleanupAttempt(
      "VERIFY_USER",
      async () => {
        residualUserCount = await admin.residualUserCount(identifiers.userName);
        if (residualUserCount !== 0) {
          throw new Error(`Residual user count is ${residualUserCount}.`);
        }
      },
      cleanupDiagnostics,
    );
    await cleanupAttempt(
      "DISCONNECT_ADMIN",
      () => admin.disconnect(),
      cleanupDiagnostics,
    );
    if (cleanupDiagnostics.length > 0) {
      cleanupFailure = new ValidationFailure(
        ExitCode.CLEANUP,
        "CLEANUP_FAILURE",
        cleanupDiagnostics.join(" | "),
      );
    }
  }

  if (controller.signal) {
    primaryFailure = new ValidationFailure(
      ExitCode.SIGNAL,
      "SIGNAL",
      `Interrupted by ${controller.signal}.`,
    );
  }
  const exitCode = cleanupFailure
    ? ExitCode.CLEANUP
    : (primaryFailure?.exitCode ?? ExitCode.SUCCESS);
  const result: EvidencePayload["result"] = controller.signal
    ? "INTERRUPTED"
    : injectionStep && primaryFailure && !cleanupFailure
      ? "EXPECTED_FAILURE"
      : exitCode === ExitCode.SUCCESS
        ? "PASS"
        : "FAIL";
  const completedAt = dependencies.now();
  const evidencePayload: EvidencePayload = {
    schemaVersion: 1,
    label: evidenceLabel,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
    mysqlVersion,
    databaseIdentifierSha256: identifierHash(identifiers.databaseName),
    userIdentifierSha256: identifierHash(identifiers.userName),
    migrationCount,
    dbTestFileCount,
    dbTestCount,
    isolationCheck,
    processTreeTerminationRequested: controller.processTreeTerminationRequested,
    cleanupDatabase,
    cleanupGuardDatabase,
    cleanupUser,
    residualDatabaseCount,
    residualUserCount,
    exitCode,
    result,
    primaryFailure: primaryFailure
      ? redactText(
          `${primaryFailure.kind}: ${primaryFailure.message}`,
          knownSecrets,
        )
      : null,
    cleanupFailure: cleanupFailure
      ? redactText(
          `${cleanupFailure.kind}: ${cleanupFailure.message}`,
          knownSecrets,
        )
      : null,
  };

  let evidence: EvidenceWriteResult | undefined;
  try {
    evidence = await dependencies.writeEvidence(evidenceLabel, evidencePayload);
    log(
      "stdout",
      `[pr6a] Evidence: ${evidence.jsonPath} (SHA256 ${evidence.sha256})\n`,
    );
  } catch (error) {
    const evidenceFailure = normalizeFailure(
      error,
      ExitCode.CLEANUP,
      "EVIDENCE_FAILURE",
    );
    cleanupFailure = cleanupFailure
      ? new ValidationFailure(
          ExitCode.CLEANUP,
          "CLEANUP_FAILURE",
          `${cleanupFailure.message} | ${evidenceFailure.kind}: ${evidenceFailure.message}`,
        )
      : evidenceFailure;
  }

  return {
    cleanupFailure,
    evidence,
    exitCode: cleanupFailure ? ExitCode.CLEANUP : exitCode,
    primaryFailure,
    signal: controller.signal,
  };
}

function createBootstrapDatabase(adminUrl: URL): BootstrapDatabase {
  const client = new PrismaClient({
    adapter: new PrismaMariaDb(adminUrl.href),
  });
  return {
    async probe() {
      await client.$queryRaw(Prisma.sql`SELECT 1`);
    },
    async readVersion() {
      const rows = await client.$queryRaw<ServerVersionRow[]>(
        Prisma.sql`SELECT VERSION() AS version, @@version_comment AS versionComment`,
      );
      if (!rows[0]) throw new Error("Unable to read the MySQL server version.");
      return rows[0];
    },
    async createDatabase(databaseName) {
      assertManagedDatabaseName(databaseName);
      await client.$executeRawUnsafe(
        `CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
      );
    },
    async createGuardDatabase(databaseName) {
      assertManagedGuardDatabaseName(databaseName);
      await client.$executeRawUnsafe(
        `CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
      );
    },
    async createGuardMarker(databaseName) {
      assertManagedGuardDatabaseName(databaseName);
      await client.$executeRawUnsafe(
        `CREATE TABLE \`${databaseName}\`.\`pr6a_guard_marker\` (\`marker\` INT NOT NULL)`,
      );
      await client.$executeRawUnsafe(
        `INSERT INTO \`${databaseName}\`.\`pr6a_guard_marker\` (\`marker\`) VALUES (1)`,
      );
    },
    async createUser(userName, password) {
      assertManagedUserName(userName);
      if (!/^[A-Za-z0-9_-]{40,64}$/.test(password)) {
        throw new Error(
          "Generated temporary password failed the safety policy.",
        );
      }
      await client.$executeRawUnsafe(
        `CREATE USER '${userName}'@'${USER_HOST}' IDENTIFIED BY '${password}'`,
      );
    },
    async grantDatabase(databaseName, userName) {
      assertManagedDatabaseName(databaseName);
      assertManagedUserName(userName);
      await client.$executeRawUnsafe(
        `GRANT ALL PRIVILEGES ON \`${databaseName}\`.* TO '${userName}'@'${USER_HOST}'`,
      );
    },
    async showGrants(userName) {
      assertManagedUserName(userName);
      const rows = await client.$queryRawUnsafe<Record<string, string>[]>(
        `SHOW GRANTS FOR '${userName}'@'${USER_HOST}'`,
      );
      return rows.flatMap((row) => Object.values(row));
    },
    async verifyIsolation(temporaryUrl, guardDatabaseName) {
      assertManagedGuardDatabaseName(guardDatabaseName);
      const temporaryClient = new PrismaClient({
        adapter: new PrismaMariaDb(temporaryUrl),
      });
      try {
        await temporaryClient.$queryRawUnsafe(
          `SELECT \`marker\` FROM \`${guardDatabaseName}\`.\`pr6a_guard_marker\``,
        );
        throw new Error(
          "Temporary user unexpectedly accessed the guard database.",
        );
      } catch (error) {
        const message = safeErrorMessage(error);
        if (
          !/(access denied|command denied|denied to user|\b1044\b|\b1142\b)/i.test(
            message,
          )
        ) {
          throw error;
        }
      } finally {
        await temporaryClient.$disconnect().catch(() => undefined);
      }
    },
    async dropDatabase(databaseName) {
      if (databaseName.startsWith(GUARD_DATABASE_PREFIX)) {
        assertManagedGuardDatabaseName(databaseName);
      } else {
        assertManagedDatabaseName(databaseName);
      }
      await client.$executeRawUnsafe(
        `DROP DATABASE IF EXISTS \`${databaseName}\``,
      );
    },
    async dropUser(userName) {
      assertManagedUserName(userName);
      await client.$executeRawUnsafe(
        `DROP USER IF EXISTS '${userName}'@'${USER_HOST}'`,
      );
    },
    async residualDatabaseCount(databaseNames) {
      for (const databaseName of databaseNames) {
        if (databaseName.startsWith(GUARD_DATABASE_PREFIX)) {
          assertManagedGuardDatabaseName(databaseName);
        } else {
          assertManagedDatabaseName(databaseName);
        }
      }
      const rows = await client.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM INFORMATION_SCHEMA.SCHEMATA
        WHERE SCHEMA_NAME IN (${Prisma.join(databaseNames)})
      `);
      return Number(rows[0]?.count ?? 0);
    },
    async residualUserCount(userName) {
      assertManagedUserName(userName);
      const rows = await client.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM mysql.user
        WHERE User = ${userName} AND Host = ${USER_HOST}
      `);
      return Number(rows[0]?.count ?? 0);
    },
    async disconnect() {
      await client.$disconnect();
    },
  };
}

function createCommandRunner(
  controller: RuntimeController,
  knownSecrets: () => string[],
): (request: CommandRequest) => Promise<CommandResult> {
  return async (request) => {
    const npmCli = process.env.npm_execpath;
    if (!npmCli) {
      throw new ValidationFailure(
        ExitCode.SPAWN,
        "SPAWN_FAILURE",
        "npm_execpath is unavailable; run this entry through npm.",
      );
    }
    process.stdout.write(`[pr6a] ${request.label}\n`);
    return new Promise<CommandResult>((resolve, reject) => {
      const child = spawn(process.execPath, [npmCli, ...request.args], {
        cwd: ROOT_DIRECTORY,
        detached: process.platform !== "win32",
        env: request.environment,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      controller.setActiveChild(child);
      let captured = "";
      const stdout = createRedactingStream((value) => {
        captured += value;
        process.stdout.write(value);
      }, knownSecrets);
      const stderr = createRedactingStream((value) => {
        captured += value;
        process.stderr.write(value);
      }, knownSecrets);
      child.stdout?.on("data", (chunk: Buffer) =>
        stdout.push(chunk.toString("utf8")),
      );
      child.stderr?.on("data", (chunk: Buffer) =>
        stderr.push(chunk.toString("utf8")),
      );
      child.once("error", (error) => {
        controller.clearActiveChild(child);
        stdout.flush();
        stderr.flush();
        reject(
          new ValidationFailure(
            ExitCode.SPAWN,
            "SPAWN_FAILURE",
            `${request.label} could not start: ${redactText(safeErrorMessage(error), knownSecrets())}`,
          ),
        );
      });
      child.once("exit", (code, signal) => {
        controller.clearActiveChild(child);
        stdout.flush();
        stderr.flush();
        if (code === 0 && !signal && !controller.signal) {
          resolve({ output: captured });
          return;
        }
        if (controller.signal) {
          reject(
            new ValidationFailure(
              ExitCode.SIGNAL,
              "SIGNAL",
              `Interrupted by ${controller.signal}.`,
            ),
          );
          return;
        }
        reject(
          new ValidationFailure(
            request.exitCode,
            request.exitCode === ExitCode.MIGRATION
              ? "MIGRATION_FAILURE"
              : "TEST_FAILURE",
            `${request.label} failed (${signal ? `signal ${signal}` : `exit ${code ?? "unknown"}`}).`,
          ),
        );
      });
    });
  };
}

export async function terminateProcessTree(child: ChildProcess): Promise<void> {
  if (!child.pid) return;
  if (process.platform === "win32") {
    const result = spawnSync(
      "taskkill",
      ["/PID", String(child.pid), "/T", "/F"],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    );
    if (result.status !== 0 && child.exitCode === null) {
      throw new Error(
        `taskkill failed with exit ${result.status ?? "unknown"}.`,
      );
    }
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  await new Promise((resolve) => setTimeout(resolve, 750));
  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
}

export function parseVitestCounts(output: string): {
  fileCount: number;
  testCount: number;
} {
  const fileCount = Number(
    /Test Files\s+(\d+)\s+passed/i.exec(output)?.[1] ?? 0,
  );
  const testCount = Number(/Tests\s+(\d+)\s+passed/i.exec(output)?.[1] ?? 0);
  return { fileCount, testCount };
}

export async function writeEvidenceFile(
  label: string,
  payload: EvidencePayload,
): Promise<EvidenceWriteResult> {
  if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(label)) {
    throw new Error(
      "PR6A_EVIDENCE_LABEL must contain only lowercase letters, numbers, and hyphens.",
    );
  }
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  const payloadJson = JSON.stringify(payload);
  const evidencePayloadSha256 = createHash("sha256")
    .update(payloadJson)
    .digest("hex");
  const json = `${JSON.stringify({ ...payload, evidencePayloadSha256 }, null, 2)}\n`;
  const sha256 = createHash("sha256").update(json).digest("hex");
  const jsonPath = path.join(EVIDENCE_DIRECTORY, `${label}.json`);
  const sha256Path = `${jsonPath}.sha256`;
  await writeFile(jsonPath, json, { encoding: "utf8", flag: "w" });
  await writeFile(sha256Path, `${sha256}  ${label}.json\n`, {
    encoding: "utf8",
    flag: "w",
  });
  return { jsonPath, sha256, sha256Path };
}

function createDefaultDependencies(
  controller: RuntimeController,
  secretProvider: () => string[],
): ValidationDependencies {
  return {
    commandRunner: createCommandRunner(controller, secretProvider),
    createBootstrapDatabase,
    createIdentifiers: createTemporaryIdentifiers,
    async migrationCount() {
      const directory = path.join(
        ROOT_DIRECTORY,
        "apps",
        "api",
        "prisma",
        "migrations",
      );
      const entries = await readdir(directory, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).length;
    },
    now: () => new Date(),
    output(stream, value) {
      (stream === "stdout" ? process.stdout : process.stderr).write(value);
    },
    sleep: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    writeEvidence: writeEvidenceFile,
  };
}

async function waitForReadiness(
  admin: BootstrapDatabase,
  dependencies: ValidationDependencies,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= READINESS_ATTEMPTS; attempt += 1) {
    try {
      await admin.probe();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < READINESS_ATTEMPTS) {
        await dependencies.sleep(READINESS_DELAY_MS);
      }
    }
  }
  throw new ValidationFailure(
    ExitCode.READINESS,
    "READINESS_TIMEOUT",
    `MySQL readiness probe failed after ${READINESS_ATTEMPTS} attempts: ${safeErrorMessage(lastError)}`,
  );
}

async function asBootstrapOperation<T>(
  kind: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ValidationFailure) throw error;
    throw new ValidationFailure(
      ExitCode.BOOTSTRAP,
      kind,
      safeErrorMessage(error),
      { cause: error },
    );
  }
}

async function cleanupAttempt(
  label: string,
  operation: () => Promise<void>,
  diagnostics: string[],
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    diagnostics.push(`${label}: ${safeErrorMessage(error)}`);
  }
}

function normalizeFailure(
  error: unknown,
  fallbackExitCode: ExitCode,
  fallbackKind: string,
): ValidationFailure {
  return error instanceof ValidationFailure
    ? error
    : new ValidationFailure(
        fallbackExitCode,
        fallbackKind,
        safeErrorMessage(error),
        {
          cause: error,
        },
      );
}

function createRedactingStream(
  write: (value: string) => void,
  secretProvider: () => string[],
): { flush: () => void; push: (value: string) => void } {
  let pending = "";
  return {
    push(value) {
      pending += value;
      const lastNewline = pending.lastIndexOf("\n");
      if (lastNewline >= 0) {
        write(redactText(pending.slice(0, lastNewline + 1), secretProvider()));
        pending = pending.slice(lastNewline + 1);
      }
    },
    flush() {
      if (pending) write(redactText(pending, secretProvider()));
      pending = "";
    },
  };
}

function identifierHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main(): Promise<number> {
  let target: AdminTarget;
  try {
    target = parseAdminTarget(process.env.PR6A_MYSQL_ADMIN_URL);
  } catch (error) {
    const failure = normalizeFailure(error, ExitCode.CONFIG, "INVALID_CONFIG");
    process.stderr.write(
      `[pr6a] PRIMARY_FAILURE: ${redactText(failure.message, [process.env.PR6A_MYSQL_ADMIN_URL ?? ""])}\n`,
    );
    return failure.exitCode;
  }

  const evidenceLabel = process.env.PR6A_EVIDENCE_LABEL ?? "latest";
  const controller = new RuntimeController();
  const secrets: string[] = [target.url.href, target.url.password];
  const dependencies = createDefaultDependencies(controller, () => secrets);
  const signalHandler = (signal: NodeJS.Signals): void => {
    process.stderr.write(
      `[pr6a] Received ${signal}; terminating the active process tree before cleanup.\n`,
    );
    controller.requestSignal(signal);
  };
  process.once("SIGINT", signalHandler);
  process.once("SIGTERM", signalHandler);

  const originalCreateIdentifiers = dependencies.createIdentifiers;
  dependencies.createIdentifiers = () => {
    const identifiers = originalCreateIdentifiers();
    secrets.push(identifiers.password);
    secrets.push(
      createDatabaseUrl(
        target.url,
        identifiers.databaseName,
        identifiers.userName,
        identifiers.password,
      ),
    );
    return identifiers;
  };

  const result = await runValidationLifecycle(
    target,
    evidenceLabel,
    controller,
    dependencies,
  );
  process.removeListener("SIGINT", signalHandler);
  process.removeListener("SIGTERM", signalHandler);

  if (result.primaryFailure) {
    process.stderr.write(
      `[pr6a] PRIMARY_FAILURE: ${redactText(`${result.primaryFailure.kind}: ${result.primaryFailure.message}`, secrets)}\n`,
    );
  }
  if (result.cleanupFailure) {
    process.stderr.write(
      `[pr6a] CLEANUP_FAILURE: ${redactText(result.cleanupFailure.message, secrets)}\n`,
    );
  }
  process.stdout.write(
    result.exitCode === ExitCode.SUCCESS ? "[pr6a] PASS\n" : "[pr6a] FAIL\n",
  );
  return result.exitCode;
}

if (require.main === module) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `[pr6a] PRIMARY_FAILURE: ${redactText(safeErrorMessage(error), [process.env.PR6A_MYSQL_ADMIN_URL ?? ""])}\n`,
      );
      process.exitCode = ExitCode.INTERNAL;
    });
}
