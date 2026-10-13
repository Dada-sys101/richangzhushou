import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  chmodSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  bootstrap,
  guard,
  verifyPr,
  BASE_BRANCH,
  BootstrapError,
  privateDirectory,
  writableNpmCache,
} from "./codex-native-bootstrap.mjs";

const SOURCE =
  process.env.BOOTSTRAP_TEST_REPOSITORY ?? "/workspace/richangzhushou";
const SHA = "20f8e7044958b8f01278392a9b97f379839a8ad5";
const ORIGINAL_SHA = "9421d819a44a47728e6d7f6e93bfd4f98f681f24";
const PARENT = "10847ee";
function git(repo, ...args) {
  const r = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    cwd: repo,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function fixture(
  t,
  { sha = SHA, setupFails = false, fetchFails = false } = {},
) {
  const temporary = mkdtempSync(path.join(tmpdir(), "native-bootstrap-test-"));
  const repo = path.join(temporary, "repo");
  const clone = spawnSync("git", ["clone", "--no-hardlinks", SOURCE, repo], {
    encoding: "utf8",
  });
  assert.equal(clone.status, 0, clone.stderr);
  // Do not let the source checkout's active bootstrap branch redefine fixtures.
  git(repo, "switch", "--no-track", "-c", "fixture-original", ORIGINAL_SHA);
  git(
    repo,
    "remote",
    "set-url",
    "origin",
    "https://github.com/Dada-sys101/richangzhushou.git",
  );
  const originalBranch = git(repo, "branch", "--show-current");
  const originalHead = git(repo, "rev-parse", "HEAD");
  const options = {
    repo,
    sha: git(repo, "rev-parse", sha),
    task: "fixture-022",
  };
  let fetches = 0;
  let setups = 0;
  let setupEnv;
  const execute = (command, args, settings) => {
    if (command === "git" && args.includes("fetch")) {
      fetches++;
      if (fetchFails)
        return { status: 128, stdout: "", stderr: "network policy denied" };
      // Read local existing commits; no remote writes and no test commits.
      writeFileSync(
        path.join(repo, ".git", "FETCH_HEAD"),
        `${options.sha}\t\tbranch '${BASE_BRANCH}'\n`,
      );
      return { status: 0, stdout: "", stderr: "" };
    }
    if (command === process.execPath && args.at(-1) === "setup") {
      setups++;
      setupEnv = settings.env;
      if (setupFails)
        return { status: 9, stdout: "fixture setup failed", stderr: "" };
      for (const file of [
        "node_modules/.fixture",
        "apps/api/src/generated/prisma/client.ts",
        "packages/api-contracts/dist/index.js",
        "packages/config/dist/index.js",
      ]) {
        mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
        writeFileSync(path.join(repo, file), "// fixture artifact\n");
      }
      return { status: 0, stdout: "fixture setup passed", stderr: "" };
    }
    return spawnSync(command, args, settings);
  };
  t.after(() => {
    assert.equal(
      git(repo, "rev-parse", originalBranch),
      originalHead,
      "original branch must remain unchanged",
    );
    rmSync(temporary, { recursive: true, force: true }); // Only this test's own clone.
  });
  return {
    repo,
    options,
    dependencies: { execute },
    counters: () => ({ fetches, setups, setupEnv }),
    originalHead,
    originalBranch,
  };
}
const rejects = (code) => (error) =>
  error instanceof BootstrapError && error.code === code;

test("first bootstrap uses Integration, protects original branch, isolates setup env, repeats without reinstall", (t) => {
  const f = fixture(t);
  process.env.BOOTSTRAP_FAKE_PRODUCTION_SECRET = "test-only";
  t.after(() => delete process.env.BOOTSTRAP_FAKE_PRODUCTION_SECRET);
  const first = bootstrap(f.options, f.dependencies);
  assert.equal(first.status, "BOOTSTRAP_READY");
  assert.equal(git(f.repo, "rev-parse", "HEAD"), SHA);
  assert.equal(git(f.repo, "merge-base", SHA, "HEAD"), SHA);
  assert.equal(git(f.repo, "diff", "--name-only", `${SHA}...HEAD`), "");
  assert.equal(git(f.repo, "status", "--porcelain"), "");
  assert.equal(
    f.counters().setupEnv.BOOTSTRAP_FAKE_PRODUCTION_SECRET,
    undefined,
  );
  assert.equal(f.counters().setupEnv.DATABASE_URL, undefined);
  assert.equal(f.counters().setupEnv.HOME, process.env.HOME);
  assert.ok(f.counters().setupEnv.TMPDIR.startsWith(path.join(f.repo, ".git")));
  const repeated = bootstrap(f.options, f.dependencies);
  assert.equal(repeated.status, "BOOTSTRAP_ALREADY_READY");
  assert.equal(repeated.branch, first.branch);
  assert.equal(f.counters().setups, 1);
  assert.equal(f.counters().fetches, 2, "repeat must re-check remote SHA");
});
test("dirty tracked and untracked files block before fetch and remain intact", (t) => {
  const f = fixture(t);
  writeFileSync(path.join(f.repo, "README.md"), "preserve this edit\n");
  writeFileSync(path.join(f.repo, "user-note.txt"), "preserve this note\n");
  assert.throws(
    () => bootstrap(f.options, f.dependencies),
    rejects("GIT_NOT_CLEAN"),
  );
  assert.equal(f.counters().fetches, 0);
  assert.equal(
    readFileSync(path.join(f.repo, "README.md"), "utf8"),
    "preserve this edit\n",
  );
  assert.equal(
    readFileSync(path.join(f.repo, "user-note.txt"), "utf8"),
    "preserve this note\n",
  );
});
test("SHA mismatch stops before switching or Setup", (t) => {
  const f = fixture(t);
  assert.throws(
    () => bootstrap({ ...f.options, sha: f.originalHead }, f.dependencies),
    rejects("INTEGRATION_SHA_MISMATCH"),
  );
  assert.equal(git(f.repo, "branch", "--show-current"), f.originalBranch);
  assert.equal(f.counters().setups, 0);
});
test("wrong repository blocks before fetch", (t) => {
  const f = fixture(t);
  git(
    f.repo,
    "remote",
    "set-url",
    "origin",
    "https://github.com/other/wrong.git",
  );
  assert.throws(
    () => bootstrap(f.options, f.dependencies),
    rejects("WRONG_REPOSITORY"),
  );
  assert.equal(f.counters().fetches, 0);
});
test("network failure stops without switching or permission changes", (t) => {
  const f = fixture(t, { fetchFails: true });
  assert.throws(
    () => bootstrap(f.options, f.dependencies),
    rejects("GIT_COMMAND_FAILED"),
  );
  assert.equal(git(f.repo, "branch", "--show-current"), f.originalBranch);
  assert.equal(f.counters().setups, 0);
});
test("ignored runtime .env blocks without reading credentials", (t) => {
  const f = fixture(t);
  writeFileSync(path.join(f.repo, ".env"), "TEST_ONLY=value\n");
  assert.throws(
    () => bootstrap(f.options, f.dependencies),
    rejects("RUNTIME_ENV_FILES_PRESENT"),
  );
  assert.equal(f.counters().fetches, 0);
});
test("Setup failure preserves branch/evidence, refuses guard, and never reports READY", (t) => {
  const f = fixture(t, { setupFails: true });
  let details;
  assert.throws(
    () => bootstrap(f.options, f.dependencies),
    (e) => {
      details = e.details;
      return rejects("SETUP_FAILED")(e);
    },
  );
  assert.ok(existsSync(details.setupLog));
  assert.equal(
    JSON.parse(readFileSync(details.stateFile)).phase,
    "SETUP_FAILED",
  );
  const scope = path.join(path.dirname(f.repo), "scope.json");
  writeFileSync(scope, "[]");
  assert.throws(
    () => guard({ ...f.options, scope }, f.dependencies),
    rejects("BOOTSTRAP_NOT_READY"),
  );
});
test("repeat refuses to switch away from another branch", (t) => {
  const f = fixture(t);
  bootstrap(f.options, f.dependencies);
  git(f.repo, "switch", f.originalBranch);
  assert.throws(
    () => bootstrap(f.options, f.dependencies),
    rejects("FEATURE_BRANCH_MISMATCH"),
  );
  assert.equal(f.counters().fetches, 1);
});
test("PR guard also blocks ignored runtime credentials", (t) => {
  const f = fixture(t);
  bootstrap(f.options, f.dependencies);
  const scope = path.join(path.dirname(f.repo), "scope.json");
  writeFileSync(scope, "[]");
  writeFileSync(path.join(f.repo, ".env"), "TEST_ONLY=value\n");
  assert.throws(
    () => guard({ ...f.options, scope }, f.dependencies),
    rejects("RUNTIME_ENV_FILES_PRESENT"),
  );
});
test("changed or missing artifact reruns setup on the same branch", (t) => {
  const f = fixture(t);
  const first = bootstrap(f.options, f.dependencies);
  writeFileSync(
    path.join(f.repo, "packages/config/dist/index.js"),
    "// changed artifact",
  );
  const second = bootstrap(f.options, f.dependencies);
  assert.equal(second.status, "BOOTSTRAP_READY");
  assert.equal(second.branch, first.branch);
  assert.equal(f.counters().setups, 2);
  rmSync(path.join(f.repo, "apps/api/src/generated/prisma/client.ts"));
  assert.equal(bootstrap(f.options, f.dependencies).status, "BOOTSTRAP_READY");
  assert.equal(f.counters().setups, 3);
});
test("unsafe temp/cache paths stop without chmod/chown or using another cache", (t) => {
  const root = mkdtempSync(
    path.join(tmpdir(), "native-bootstrap-permissions-"),
  );
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const publicTmp = path.join(root, "public");
  mkdirSync(publicTmp);
  chmodSync(publicTmp, 0o777);
  assert.throws(
    () => privateDirectory(publicTmp),
    rejects("RUNTIME_DIRECTORY_NOT_PRIVATE"),
  );
  const linkedTmp = path.join(root, "linked");
  symlinkSync(publicTmp, linkedTmp);
  assert.throws(
    () => privateDirectory(linkedTmp),
    rejects("UNSAFE_RUNTIME_DIRECTORY"),
  );
  const cache = path.join(root, "cache");
  mkdirSync(cache);
  chmodSync(cache, 0o500);
  assert.throws(
    () => writableNpmCache(cache),
    rejects("NPM_CACHE_NOT_WRITABLE"),
  );
  chmodSync(cache, 0o700);
  writeFileSync(path.join(cache, "_cacache"), "not a usable cache directory");
  assert.throws(
    () => writableNpmCache(cache),
    rejects("NPM_CACHE_NOT_WRITABLE"),
  );
  assert.equal(
    readFileSync(path.join(cache, "_cacache"), "utf8"),
    "not a usable cache directory",
  );
});
test("lock and repeat SHA drift stop without another setup", (t) => {
  const f = fixture(t);
  const ready = bootstrap(f.options, f.dependencies);
  const lock = path.join(path.dirname(ready.stateFile), "active.lock");
  writeFileSync(lock, "another task's lock");
  assert.throws(
    () => bootstrap(f.options, f.dependencies),
    rejects("BOOTSTRAP_LOCKED"),
  );
  assert.equal(readFileSync(lock, "utf8"), "another task's lock");
  rmSync(lock);
  const drift = {
    execute: (command, args, settings) => {
      if (command === "git" && args.includes("fetch")) {
        writeFileSync(
          path.join(f.repo, ".git", "FETCH_HEAD"),
          `${f.originalHead}\n`,
        );
        return { status: 0, stdout: "", stderr: "" };
      }
      return f.dependencies.execute(command, args, settings);
    },
  };
  assert.throws(
    () => bootstrap(f.options, drift),
    rejects("INTEGRATION_SHA_MISMATCH"),
  );
  assert.equal(f.counters().setups, 1);
});
test("guard and PR readback reject old main, wrong head, wrong SHA, incomplete files and unreviewed scope", (t) => {
  const f = fixture(t, { sha: PARENT });
  const ready = bootstrap(f.options, f.dependencies);
  // Fast-forward only this disposable local branch to a commit that already exists.
  // No commit/merge/reset/push is performed, including in fixtures.
  git(f.repo, "read-tree", "-u", "-m", f.options.sha, SHA);
  git(f.repo, "update-ref", `refs/heads/${ready.branch}`, SHA, f.options.sha);
  const files = git(
    f.repo,
    "diff",
    "--no-renames",
    "--name-only",
    `${f.options.sha}...HEAD`,
  )
    .split("\n")
    .filter(Boolean)
    .sort();
  assert.ok(files.length > 0);
  const scope = path.join(path.dirname(f.repo), "scope.json");
  writeFileSync(scope, JSON.stringify(files));
  const guarded = guard({ ...f.options, scope }, f.dependencies);
  assert.equal(guarded.status, "PR_BASE_GUARD_PASS");
  assert.equal(guarded.automaticPrAllowed, false);
  assert.throws(
    () => bootstrap(f.options, f.dependencies),
    rejects("REINITIALIZATION_AFTER_DEVELOPMENT_BLOCKED"),
  );
  const repo = { full_name: "Dada-sys101/richangzhushou" };
  const good = {
    number: 123,
    base: { repo, ref: BASE_BRANCH, sha: f.options.sha },
    head: { repo, ref: ready.branch, sha: SHA },
    changed_files: files.length,
  };
  const pr = path.join(path.dirname(f.repo), "pr.json");
  const prFiles = path.join(path.dirname(f.repo), "files.json");
  writeFileSync(
    prFiles,
    JSON.stringify(files.map((filename) => ({ filename, status: "modified" }))),
  );
  const options = { ...f.options, scope, pr, files: prFiles };
  writeFileSync(pr, JSON.stringify(good));
  assert.equal(verifyPr(options, f.dependencies).status, "PR_READBACK_PASS");
  for (const [snapshot, error] of [
    [{ ...good, base: { ...good.base, ref: "main" } }, "PR_BASE_MISMATCH"],
    [
      { ...good, base: { ...good.base, sha: f.originalHead } },
      "PR_BASE_MISMATCH",
    ],
    [{ ...good, head: { ...good.head, ref: "work" } }, "PR_HEAD_MISMATCH"],
    [
      { ...good, head: { ...good.head, sha: f.options.sha } },
      "PR_HEAD_MISMATCH",
    ],
    [{ ...good, changed_files: good.changed_files + 1 }, "PR_FILES_INCOMPLETE"],
  ]) {
    writeFileSync(pr, JSON.stringify(snapshot));
    assert.throws(() => verifyPr(options, f.dependencies), rejects(error));
  }
  writeFileSync(scope, "[]");
  assert.throws(
    () => guard({ ...f.options, scope }, f.dependencies),
    rejects("UNREVIEWED_DIFF_SCOPE"),
  );
});
