import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildGovernanceSummary } from "../lib/dependency-governance.mjs";

mkdirSync("results", { recursive: true });

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const packages = readJson("results/dependency-license-matrix.json");
const notices = readFileSync("results/THIRD_PARTY_NOTICES.md", "utf8");
const sbom = readJson("results/sbom.cdx.json");
const audit = readJson("results/npm-audit.json");
const auditExitCode = Number(
  readFileSync("results/npm-audit-exit-code.txt", "utf8").trim(),
);
const exceptions = readJson("dependency-governance-exceptions.json");
const summary = buildGovernanceSummary({
  packages,
  notices,
  sbom,
  audit,
  auditExitCode,
  exceptions,
});
writeFileSync(
  "results/07-dependency-governance.json",
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
if (summary.state !== "PASS") process.exitCode = 1;
