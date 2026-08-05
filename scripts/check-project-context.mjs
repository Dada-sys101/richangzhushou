#!/usr/bin/env node
// Project context validation script (no external dependencies).
// Run: node scripts/check-project-context.mjs
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_FILES = [
  "AGENTS.md",
  ".project/context.md",
  ".project/session.md",
  "docs/progress.md",
  "docs/roadmap.md",
  "docs/changelog.md",
];

const CONTEXT_SECTIONS = [
  "Last Updated",
  "Current Task",
  "Next Recommended Task",
  "Verification Status",
  "Handoff Instructions",
];

const SESSION_SECTIONS = [
  "Session Status",
  "Task",
  "Current Progress",
  "Resume Instructions",
  "Last Updated",
];

const SENSITIVE_PATTERNS = [
  /(?:api[_-]?key|password|passwd|secret|token|private[ _-]?key)\s*[:=]\s*\S+/i,
  /BEGIN (?:RSA|OPENSSH|EC|DSA|PRIVATE) KEY/i,
  /(?:sk|pk|ghp|gho|ghs)_[A-Za-z0-9]{20,}/i,
  /AKIA[0-9A-Z]{16}/,
];

const errors = [];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasSection(text, sectionName) {
  return new RegExp(`^##\\s+${escapeRegExp(sectionName)}\\s*$`, "m").test(text);
}

async function fileExists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function checkSensitive(text, relativePath) {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      errors.push(`${relativePath}: 疑似包含敏感字段（匹配 ${pattern}）`);
      return;
    }
  }
}

for (const file of REQUIRED_FILES) {
  if (!(await fileExists(file))) {
    errors.push(`缺失文件: ${file}`);
    continue;
  }
  const text = await readText(file);
  if (text.trim().length === 0) {
    errors.push(`${file}: 文件为空`);
  }
}

if (await fileExists(".project/context.md")) {
  const text = await readText(".project/context.md");
  for (const section of CONTEXT_SECTIONS) {
    if (!hasSection(text, section)) {
      errors.push(`.project/context.md 缺少必填章节: ${section}`);
    }
  }
  checkSensitive(text, ".project/context.md");
}

if (await fileExists(".project/session.md")) {
  const text = await readText(".project/session.md");
  for (const section of SESSION_SECTIONS) {
    if (!hasSection(text, section)) {
      errors.push(`.project/session.md 缺少必填章节: ${section}`);
    }
  }
  checkSensitive(text, ".project/session.md");
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[FAIL] ${error}`);
  }
  console.error("Project context validation failed.");
  process.exit(1);
}

console.log("Project context validation passed.");
