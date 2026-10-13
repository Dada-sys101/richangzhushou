#!/usr/bin/env node
// Standalone: can be exported with git show from an approved commit on old main.
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const REPOSITORY = "Dada-sys101/richangzhushou";
export const BASE_BRANCH = "codex/v15-integration-foundation";
const SETUP = "scripts/codex-cloud-setup.mjs";

export class BootstrapError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.code = code;
    this.details = details;
  }
}
function requireCondition(condition, code, details) {
  if (!condition) throw new BootstrapError(code, details);
}
export function privateDirectory(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = lstatSync(directory);
  requireCondition(
    !stat.isSymbolicLink() && stat.isDirectory(),
    "UNSAFE_RUNTIME_DIRECTORY",
  );
  requireCondition(
    !process.getuid || stat.uid === process.getuid(),
    "RUNTIME_DIRECTORY_OWNER_MISMATCH",
  );
  requireCondition((stat.mode & 0o077) === 0, "RUNTIME_DIRECTORY_NOT_PRIVATE");
  requireCondition(
    (stat.mode & 0o700) === 0o700,
    "RUNTIME_DIRECTORY_NOT_WRITABLE",
  );
  // A real write probe also catches read-only mounts and ACL restrictions.
  const probe = path.join(directory, `.probe-${randomUUID()}`);
  const fd = openSync(probe, "wx", 0o600);
  closeSync(fd);
  unlinkSync(probe);
  return directory;
}
function atomicJson(file, value) {
  const temporary = `${file}.${randomUUID()}`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  renameSync(temporary, file);
}
function context(options, dependencies = {}) {
  requireCondition(
    /^[0-9a-f]{40}$/.test(options.sha ?? ""),
    "APPROVED_SHA_REQUIRED",
  );
  requireCondition(
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(options.task ?? ""),
    "INVALID_TASK_ID",
  );
  const repo = realpathSync(options.repo ?? "/workspace/richangzhushou");
  const execute = dependencies.execute ?? spawnSync;
  const gitEnv = {
    ...process.env,
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
  };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_COMMON_DIR",
  ])
    delete gitEnv[key];
  function git(args, allowFailure = false) {
    const result = execute(
      "git",
      ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...args],
      {
        cwd: repo,
        env: gitEnv,
        encoding: "utf8",
        shell: false,
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    if (!allowFailure)
      requireCondition(
        !result.error && result.status === 0,
        "GIT_COMMAND_FAILED",
        { operation: args[0] },
      );
    return result;
  }
  const value = (args) => git(args).stdout.trim();
  requireCondition(
    realpathSync(value(["rev-parse", "--show-toplevel"])) === repo,
    "REPOSITORY_ROOT_REQUIRED",
  );
  const origin = value(["remote", "get-url", "origin"]);
  requireCondition(
    [
      `https://github.com/${REPOSITORY}.git`,
      `https://github.com/${REPOSITORY}`,
      `git@github.com:${REPOSITORY}.git`,
      `ssh://git@github.com/${REPOSITORY}.git`,
    ].includes(origin),
    "WRONG_REPOSITORY",
  );
  const gitDir = realpathSync(value(["rev-parse", "--absolute-git-dir"]));
  const directory = path.join(gitDir, "codex-native-bootstrap");
  const taskKey = createHash("sha256")
    .update(options.task)
    .digest("hex")
    .slice(0, 20);
  const stateFile = path.join(directory, `${taskKey}.json`);
  return { options, repo, git, value, execute, directory, stateFile };
}
function clean(c) {
  requireCondition(
    c.value(["status", "--porcelain=v1", "--untracked-files=all"]) === "",
    "GIT_NOT_CLEAN",
  );
}
function noRuntimeCredentials(c) {
  for (const directory of ["", "apps/api", "apps/web", "apps/admin"]) {
    const files = readdirSync(path.join(c.repo, directory));
    requireCondition(
      !files.some(
        (name) =>
          (name === ".env" || name.startsWith(".env.")) &&
          !name.endsWith(".example"),
      ),
      "RUNTIME_ENV_FILES_PRESENT",
    );
  }
}
function validateState(c, state, initial = false) {
  requireCondition(
    state.version === 1 &&
      state.repository === REPOSITORY &&
      state.repo === c.repo &&
      state.task === c.options.task &&
      state.approvedSha === c.options.sha,
    "BOOTSTRAP_STATE_MISMATCH",
  );
  requireCondition(
    /^codex\/task-[a-z0-9._-]+-[0-9a-f]{12}$/.test(state.branch),
    "INVALID_FEATURE_BRANCH",
  );
  requireCondition(
    c.value(["branch", "--show-current"]) === state.branch,
    "FEATURE_BRANCH_MISMATCH",
  );
  requireCondition(
    c.git(["merge-base", "--is-ancestor", state.approvedSha, "HEAD"], true)
      .status === 0,
    "INTEGRATION_NOT_ANCESTOR",
  );
  requireCondition(
    c.value(["merge-base", state.approvedSha, "HEAD"]) === state.approvedSha,
    "MERGE_BASE_MISMATCH",
  );
  if (initial) {
    requireCondition(
      c.value(["rev-parse", "HEAD"]) === state.approvedSha,
      "REINITIALIZATION_AFTER_DEVELOPMENT_BLOCKED",
    );
    requireCondition(
      c.value(["diff", "--name-only", `${state.approvedSha}...HEAD`]) === "",
      "INITIAL_DIFF_NOT_EMPTY",
    );
  }
}
function readState(c) {
  requireCondition(existsSync(c.stateFile), "BOOTSTRAP_STATE_REQUIRED");
  requireCondition(
    !lstatSync(c.stateFile).isSymbolicLink(),
    "UNSAFE_STATE_FILE",
  );
  return JSON.parse(readFileSync(c.stateFile, "utf8"));
}
function artifactsPresent(c) {
  return [
    "node_modules",
    "apps/api/src/generated/prisma/client.ts",
    "packages/api-contracts/dist/index.js",
    "packages/config/dist/index.js",
  ].every((file) => existsSync(path.join(c.repo, file)));
}
function artifactFingerprint(c) {
  const hash = createHash("sha256");
  for (const file of [
    "package-lock.json",
    "node_modules/.package-lock.json",
    "apps/api/src/generated/prisma/client.ts",
    "packages/api-contracts/dist/index.js",
    "packages/config/dist/index.js",
  ]) {
    hash.update(file);
    hash.update(
      existsSync(path.join(c.repo, file))
        ? readFileSync(path.join(c.repo, file))
        : "MISSING",
    );
  }
  return hash.digest("hex");
}
function setupEnvironment(tmp) {
  const env = {};
  for (const key of [
    "PATH",
    "Path",
    "HOME",
    "USERPROFILE",
    "SystemRoot",
    "SYSTEMROOT",
    "COMSPEC",
    "PATHEXT",
    "LOCALAPPDATA",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "no_proxy",
    "NODE_EXTRA_CA_CERTS",
    "SSL_CERT_FILE",
  ])
    if (process.env[key] !== undefined) env[key] = process.env[key];
  // The existing setup strips application secrets again and sets fake/local flags.
  return { ...env, TMPDIR: tmp, TMP: tmp, TEMP: tmp };
}
// Load only build/toolchain libraries and generated Prisma code. Never create a
// client, connect to a database, import application services or execute a CLI.
const dependencyProbeSource = `
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(path.resolve('apps/api/package.json'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
for (const name of ['prisma', '@prisma/client', '@prisma/adapter-mariadb', 'argon2', 'typescript', 'tsx']) {
  const manifest = JSON.parse(readFileSync('node_modules/' + name + '/package.json', 'utf8'));
  const expected = lock.packages['node_modules/' + name]?.version;
  assert.ok(expected);
  assert.equal(manifest.name, name);
  assert.equal(manifest.version, expected);
}
assert.ok(existsSync('node_modules/prisma/build/index.js'));
require('@prisma/client/runtime/client');
assert.equal(typeof require('@prisma/adapter-mariadb').PrismaMariaDb, 'function');
assert.equal(typeof require('argon2').hash, 'function');
assert.equal(require('typescript').version, lock.packages['node_modules/typescript'].version);
const client = require(path.resolve('apps/api/src/generated/prisma/client.ts'));
assert.equal(typeof client.PrismaClient, 'function');
assert.equal(client.Prisma.prismaVersion.client, lock.packages['node_modules/@prisma/client'].version);
for (const file of ['packages/api-contracts/dist/index.js', 'packages/config/dist/index.js']) {
  const module = await import(pathToFileURL(path.resolve(file)).href);
  assert.ok(Object.keys(module).length > 0);
}
process.stdout.write('DEPENDENCY_PROBE_PASS\\n');
`;
export function probeDependencies(repo, tmp, execute = spawnSync) {
  const result = execute(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", dependencyProbeSource],
    {
      cwd: repo,
      env: setupEnvironment(tmp),
      encoding: "utf8",
      shell: false,
      timeout: 20_000,
      maxBuffer: 1024 * 1024,
    },
  );
  return (
    !result.error &&
    result.status === 0 &&
    result.stdout === "DEPENDENCY_PROBE_PASS\n"
  );
}
export function writableNpmCache(cache) {
  try {
    mkdirSync(cache, { recursive: true });
    for (const directory of [
      cache,
      path.join(cache, "_cacache"),
      path.join(cache, "_cacache/tmp"),
      path.join(cache, "_logs"),
    ]) {
      if (!existsSync(directory)) continue;
      const stat = lstatSync(directory);
      requireCondition(
        !stat.isSymbolicLink() && stat.isDirectory(),
        "UNSAFE_NPM_CACHE",
      );
      requireCondition(
        !process.getuid || stat.uid === process.getuid(),
        "NPM_CACHE_OWNER_MISMATCH",
      );
      requireCondition((stat.mode & 0o300) === 0o300, "NPM_CACHE_NOT_WRITABLE");
      const probe = path.join(directory, `.codex-probe-${randomUUID()}`);
      const fd = openSync(probe, "wx", 0o600);
      closeSync(fd);
      unlinkSync(probe);
    }
  } catch {
    throw new BootstrapError("NPM_CACHE_NOT_WRITABLE", { cache });
  }
  return cache;
}
function checkLegacyCache() {
  // The approved 20f8e704 setup does not forward cache overrides. Check its actual
  // HOME/.npm cache; never silently claim that an ignored override isolated it.
  const home = process.env.HOME ?? process.env.USERPROFILE;
  requireCondition(home, "NPM_CACHE_HOME_REQUIRED");
  return writableNpmCache(path.join(home, ".npm"));
}

export function bootstrap(options, dependencies = {}) {
  const c = context(options, dependencies);
  clean(c);
  requireCondition(
    Number(process.versions.node.split(".")[0]) === 24,
    "NODE_24_REQUIRED",
  );
  noRuntimeCredentials(c);
  privateDirectory(c.directory);
  const lock = path.join(c.directory, "active.lock");
  let lockFd;
  try {
    lockFd = openSync(lock, "wx", 0o600);
  } catch {
    throw new BootstrapError("BOOTSTRAP_LOCKED");
  }
  let state;
  try {
    state = existsSync(c.stateFile) ? readState(c) : null;
    if (state) validateState(c, state, true);
    // No forced update, no remote branch mutation, no network policy override.
    c.git(["fetch", "--no-tags", "origin", `refs/heads/${BASE_BRANCH}`]);
    const fetched = c.value(["rev-parse", "FETCH_HEAD"]);
    requireCondition(fetched === options.sha, "INTEGRATION_SHA_MISMATCH", {
      expected: options.sha,
      fetched,
    });
    clean(c);
    if (!state) {
      const originalBranch = c.value(["branch", "--show-current"]);
      requireCondition(originalBranch !== "", "DETACHED_CHECKOUT_BLOCKED");
      const originalHead = c.value(["rev-parse", "HEAD"]);
      const branch = `codex/task-${options.task.toLowerCase()}-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
      c.git(["switch", "--no-track", "-c", branch, options.sha]);
      state = {
        version: 1,
        repository: REPOSITORY,
        repo: c.repo,
        task: options.task,
        approvedSha: options.sha,
        branch,
        originalBranch,
        originalHead,
        phase: "SETUP_PENDING",
      };
      atomicJson(c.stateFile, state);
    }
    validateState(c, state, true);
    clean(c);
    noRuntimeCredentials(c);
    const setupFile = path.join(c.repo, SETUP);
    requireCondition(
      readFileSync(setupFile, "utf8") ===
        c.git(["show", `${options.sha}:${SETUP}`]).stdout,
      "SETUP_NOT_APPROVED_VERSION",
    );
    if (
      state.phase === "READY" &&
      artifactsPresent(c) &&
      state.artifactFingerprint === artifactFingerprint(c)
    ) {
      const probeTmp = privateDirectory(
        mkdtempSync(path.join(c.directory, "probe-")),
      );
      if (probeDependencies(c.repo, probeTmp, c.execute))
        return {
          status: "BOOTSTRAP_ALREADY_READY",
          ...state,
          stateFile: c.stateFile,
          cwd: c.repo,
          prBase: BASE_BRANCH,
          platformDiffBase: "NOT_VERIFIED",
          automaticPrAllowed: false,
        };
      // A broken dependency graph must not retain a usable READY marker.
      state.phase = "DEPENDENCIES_INVALID";
      atomicJson(c.stateFile, state);
    }
    // Invalidate any old READY marker before repair, including a successful
    // installer that later leaves missing artifacts or fails a post-check.
    state.phase = "SETUP_PENDING";
    atomicJson(c.stateFile, state);
    const cache = checkLegacyCache();
    const tmp = privateDirectory(
      mkdtempSync(path.join(c.directory, "runtime-")),
    );
    const result = c.execute(process.execPath, [setupFile, "setup"], {
      cwd: c.repo,
      env: setupEnvironment(tmp),
      encoding: "utf8",
      shell: false,
      maxBuffer: 64 * 1024 * 1024,
    });
    const log = path.join(tmp, "setup.log");
    writeFileSync(log, (result.stdout ?? "") + (result.stderr ?? ""), {
      mode: 0o600,
      flag: "wx",
    });
    state.setupLog = log;
    state.cache = {
      mode: "existing-setup-default-checked-writable",
      path: cache,
    };
    if (result.error || result.status !== 0) {
      state.phase = "SETUP_FAILED";
      atomicJson(c.stateFile, state);
      throw new BootstrapError("SETUP_FAILED", {
        exitCode: result.status,
        setupLog: log,
        branch: state.branch,
        stateFile: c.stateFile,
      });
    }
    validateState(c, state, true);
    clean(c);
    requireCondition(
      c.value(["rev-parse", state.originalBranch]) === state.originalHead,
      "ORIGINAL_BRANCH_CHANGED",
    );
    requireCondition(artifactsPresent(c), "SETUP_ARTIFACTS_MISSING");
    if (!probeDependencies(c.repo, tmp, c.execute)) {
      state.phase = "DEPENDENCIES_INVALID";
      atomicJson(c.stateFile, state);
      throw new BootstrapError("DEPENDENCY_VALIDATION_FAILED", {
        setupLog: log,
      });
    }
    state.phase = "READY";
    state.artifactFingerprint = artifactFingerprint(c);
    atomicJson(c.stateFile, state);
    return {
      status: "BOOTSTRAP_READY",
      ...state,
      stateFile: c.stateFile,
      cwd: c.repo,
      prBase: BASE_BRANCH,
      platformDiffBase: "NOT_VERIFIED",
      automaticPrAllowed: false,
    };
  } catch (error) {
    if (error instanceof BootstrapError && state)
      error.details = {
        ...error.details,
        branch: state.branch,
        stateFile: c.stateFile,
        originalBranch: state.originalBranch,
        originalHead: state.originalHead,
      };
    throw error;
  } finally {
    closeSync(lockFd);
    unlinkSync(lock);
  }
}

function reviewedScope(options) {
  const scope = JSON.parse(readFileSync(options.scope, "utf8"));
  requireCondition(
    Array.isArray(scope) &&
      scope.every(
        (file) =>
          typeof file === "string" &&
          file !== "" &&
          !file.startsWith("/") &&
          !file.split("/").includes("..") &&
          !/[\r\n\0]/.test(file),
      ),
    "INVALID_REVIEWED_SCOPE",
  );
  requireCondition(
    new Set(scope).size === scope.length,
    "DUPLICATE_SCOPE_FILES",
  );
  return scope.sort();
}
export function guard(options, dependencies = {}) {
  const c = context(options, dependencies);
  clean(c);
  noRuntimeCredentials(c);
  const state = readState(c);
  requireCondition(state.phase === "READY", "BOOTSTRAP_NOT_READY");
  validateState(c, state);
  const files = c
    .git([
      "diff",
      "--no-renames",
      "--name-only",
      "-z",
      `${state.approvedSha}...HEAD`,
    ])
    .stdout.split("\0")
    .filter(Boolean)
    .sort();
  requireCondition(
    JSON.stringify(files) === JSON.stringify(reviewedScope(options)),
    "UNREVIEWED_DIFF_SCOPE",
    { files },
  );
  const headSha = c.value(["rev-parse", "HEAD"]);
  return {
    status: "PR_BASE_GUARD_PASS",
    repository: REPOSITORY,
    base: BASE_BRANCH,
    baseSha: state.approvedSha,
    head: state.branch,
    headSha,
    files,
    hasChanges: files.length > 0,
    semanticReview: "USER_REVIEW_REQUIRED",
    platformDiffBase: "NOT_VERIFIED",
    automaticPrAllowed: false,
    requiresSeparateAuthorization: ["commit", "push", "create-pr"],
  };
}
export function verifyPr(options, dependencies = {}) {
  const result = guard(options, dependencies);
  const pr = JSON.parse(readFileSync(options.pr, "utf8"));
  const files = JSON.parse(readFileSync(options.files, "utf8"));
  requireCondition(
    pr.base?.repo?.full_name === REPOSITORY &&
      pr.head?.repo?.full_name === REPOSITORY,
    "PR_REPOSITORY_MISMATCH",
  );
  requireCondition(
    pr.base?.ref === result.base && pr.base?.sha === result.baseSha,
    "PR_BASE_MISMATCH",
  );
  requireCondition(
    pr.head?.ref === result.head && pr.head?.sha === result.headSha,
    "PR_HEAD_MISMATCH",
  );
  requireCondition(
    Array.isArray(files) &&
      Number.isInteger(pr.changed_files) &&
      files.length === pr.changed_files,
    "PR_FILES_INCOMPLETE",
  );
  const names = files.flatMap((file) =>
    file.status === "renamed"
      ? [file.filename, file.previous_filename]
      : [file.filename],
  );
  requireCondition(
    names.every((name) => typeof name === "string"),
    "INVALID_PR_FILES",
  );
  requireCondition(
    JSON.stringify([...new Set(names)].sort()) === JSON.stringify(result.files),
    "PR_FILES_MISMATCH",
  );
  requireCondition(result.hasChanges, "EMPTY_PR_BLOCKED");
  return {
    ...result,
    status: "PR_READBACK_PASS",
    prNumber: pr.number,
    evidenceSource:
      "caller-supplied GitHub REST snapshots; caller must obtain fresh complete paginated responses",
  };
}
export function parseArguments(argv) {
  const [mode, ...flags] = argv;
  requireCondition(
    ["bootstrap", "guard", "verify-pr"].includes(mode),
    "INVALID_MODE",
  );
  const options = {};
  for (let i = 0; i < flags.length; i += 2) {
    requireCondition(
      ["--repo", "--task", "--sha", "--scope", "--pr", "--files"].includes(
        flags[i],
      ) &&
        flags[i + 1] &&
        !flags[i + 1].startsWith("--"),
      "INVALID_ARGUMENTS",
    );
    const key = flags[i].slice(2);
    requireCondition(!(key in options), "DUPLICATE_ARGUMENT");
    options[key] = flags[i + 1];
  }
  requireCondition(
    mode === "bootstrap"
      ? !options.scope && !options.pr && !options.files
      : Boolean(options.scope),
    "INVALID_ARGUMENTS",
  );
  requireCondition(
    mode !== "verify-pr" || Boolean(options.pr && options.files),
    "PR_SNAPSHOTS_REQUIRED",
  );
  return { mode, options };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const { mode, options } = parseArguments(process.argv.slice(2));
    const result = { bootstrap, guard, "verify-pr": verifyPr }[mode](options);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (error) {
    // Never echo raw Git stderr or exception text that might contain credentials.
    process.stdout.write(
      JSON.stringify({
        status: "BOOTSTRAP_BLOCKED",
        code: error.code ?? "LOCAL_OPERATION_FAILED",
        details: error instanceof BootstrapError ? error.details : {},
      }) + "\n",
    );
    process.exitCode = 1;
  }
}
