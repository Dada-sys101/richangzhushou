#!/usr/bin/env node
// Optional pre-commit context check (cross-platform, no external dependencies).
// Run directly: node scripts/pre-commit-context-check.mjs
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exitCode = 1;
}

// 1) Run the main validator.
const validator = spawnSync(
  process.execPath,
  [path.join(root, "scripts/check-project-context.mjs")],
  { cwd: root, stdio: "inherit" },
);
if (validator.status !== 0) {
  process.exit(validator.status ?? 1);
}

// 2) Light consistency check: an active session must not conflict with context.
const sessionText = await readFile(
  path.join(root, ".project/session.md"),
  "utf8",
);
const contextText = await readFile(
  path.join(root, ".project/context.md"),
  "utf8",
);

const sessionStatusMatch = sessionText.match(
  /^##\s+Session Status\s*\r?\n([^\r\n#]+)/m,
);
const sessionStatus = sessionStatusMatch?.[1]?.trim() ?? "";

if (["In Progress", "Paused", "Blocked"].includes(sessionStatus)) {
  const taskMatch = sessionText.match(/^##\s+Task\s*\r?\n([^\r\n#]+)/m);
  const task = taskMatch?.[1]?.trim() ?? "";
  if (task && task !== "None") {
    const currentTaskMatch = contextText.match(
      /^##\s+Current Task\s*\r?\n([\s\S]*?)(?=^##\s)/m,
    );
    const currentTask = currentTaskMatch?.[1]?.trim() ?? "";
    if (!currentTask || currentTask === "None") {
      fail("session.md 标记任务进行中，但 context.md 的 Current Task 为 None");
    }
  }
}

if (process.exitCode) {
  console.error("Pre-commit project context check failed.");
  process.exit(process.exitCode);
}

console.log("Pre-commit project context check passed.");
