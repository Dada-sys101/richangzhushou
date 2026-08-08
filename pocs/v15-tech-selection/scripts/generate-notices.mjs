import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { renderThirdPartyNotices } from "../lib/dependency-governance.mjs";

mkdirSync("results", { recursive: true });

function npmTree(argumentsList) {
  const result = spawnSync("npm", argumentsList, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (!result.stdout.trim()) {
    throw new Error(`NPM_TREE_UNAVAILABLE: ${result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout);
}

function collectTreeIdentities(tree, output = new Set()) {
  for (const [name, dependency] of Object.entries(tree?.dependencies ?? {})) {
    if (dependency?.version) output.add(`${name}@${dependency.version}`);
    collectTreeIdentities(dependency, output);
  }
  return output;
}

const productionIdentities = collectTreeIdentities(
  npmTree(["ls", "--omit=dev", "--all", "--json"]),
);
const packages = new Map();
const visitedNodeModules = new Set();

function packageDirectories(nodeModulesDirectory) {
  if (!existsSync(nodeModulesDirectory)) return [];
  const directories = [];
  for (const name of readdirSync(nodeModulesDirectory)) {
    if (name.startsWith(".")) continue;
    const path = join(nodeModulesDirectory, name);
    if (!statSync(path).isDirectory()) continue;
    if (name.startsWith("@")) {
      for (const child of readdirSync(path)) {
        const childPath = join(path, child);
        if (statSync(childPath).isDirectory()) directories.push(childPath);
      }
    } else {
      directories.push(path);
    }
  }
  return directories;
}

function inspectPackage(directory) {
  const manifestPath = join(directory, "package.json");
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!manifest.name || !manifest.version) return;
  const identity = `${manifest.name}@${manifest.version}`;
  const row = {
    name: manifest.name,
    version: manifest.version,
    scope: productionIdentities.has(identity) ? "production" : "development",
    license: manifest.license ?? manifest.licenses ?? "UNKNOWN",
    repository:
      typeof manifest.repository === "string"
        ? manifest.repository
        : (manifest.repository?.url ?? null),
    homepage: manifest.homepage ?? null,
  };
  const existing = packages.get(identity);
  if (!existing || existing.scope === "development")
    packages.set(identity, row);
}

function walkNodeModules(nodeModulesDirectory) {
  if (!existsSync(nodeModulesDirectory)) return;
  const real = realpathSync(nodeModulesDirectory);
  if (visitedNodeModules.has(real)) return;
  visitedNodeModules.add(real);
  for (const directory of packageDirectories(nodeModulesDirectory)) {
    inspectPackage(directory);
    walkNodeModules(join(directory, "node_modules"));
  }
}

walkNodeModules("node_modules");
const matrix = [...packages.values()].sort((left, right) =>
  `${left.name}@${left.version}`.localeCompare(
    `${right.name}@${right.version}`,
  ),
);
writeFileSync(
  "results/dependency-license-matrix.json",
  JSON.stringify(matrix, null, 2),
);
const notices = renderThirdPartyNotices(matrix);
writeFileSync("results/THIRD_PARTY_NOTICES.md", notices);
console.log(
  `Recorded ${matrix.length} installed packages (${matrix.filter((item) => item.scope !== "development").length} release-gated)`,
);
